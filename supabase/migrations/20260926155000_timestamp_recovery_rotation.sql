create or replace function public.run_customer_recovery_action(
  p_incident_id uuid,
  p_action_type text,
  p_evidence_note text default null,
  p_secret_hash text default null,
  p_secret_prefix text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_incident public.incidents%rowtype;
  v_origin public.agents%rowtype;
  v_role text;
  v_plan public.recovery_plans%rowtype;
  v_check_key text;
  v_action_id uuid;
  v_evidence_id uuid;
  v_new_credential_id uuid;
  v_old_credential_id uuid;
  v_cancelled integer:=0;
  v_checks jsonb;
  v_source text;
  v_result jsonb:='{}'::jsonb;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;

  if p_action_type not in (
    'verify_origin_remediated',
    'rotate_credentials',
    'review_memory',
    'cancel_pending_jobs'
  ) then raise exception 'unsupported_recovery_action'; end if;

  select i.* into v_incident
  from public.incidents i
  where i.id=p_incident_id and i.state::text='recovering'
  for update;

  if v_incident.id is null then raise exception 'incident_not_recovering'; end if;

  select wm.role::text into v_role
  from public.workspace_members wm
  where wm.workspace_id=v_incident.workspace_id
    and wm.user_id=v_uid
  limit 1;

  if v_role is null or v_role not in ('owner','admin','analyst') then
    raise exception 'insufficient_role';
  end if;

  if p_action_type='rotate_credentials' and v_role not in ('owner','admin') then
    raise exception 'owner_or_admin_required_for_rotation';
  end if;

  select a.* into v_origin
  from public.agents a
  where a.id=v_incident.origin_agent_id
    and a.workspace_id=v_incident.workspace_id
  limit 1;

  if v_origin.id is null then raise exception 'incident_origin_missing'; end if;

  select rp.* into v_plan
  from public.recovery_plans rp
  where rp.incident_id=p_incident_id
    and rp.workspace_id=v_incident.workspace_id
  for update;

  if v_plan.id is null then raise exception 'recovery_plan_not_found'; end if;

  if p_action_type in ('verify_origin_remediated','review_memory','cancel_pending_jobs') then
    if length(trim(coalesce(p_evidence_note,'')))<8 then
      raise exception 'evidence_note_required';
    end if;
  end if;

  v_check_key:=case p_action_type
    when 'verify_origin_remediated' then 'originPatched'
    when 'rotate_credentials' then 'credentialsRotated'
    when 'review_memory' then 'memoryReviewed'
    when 'cancel_pending_jobs' then 'pendingJobsReviewed'
  end;

  v_source:=case when p_action_type='rotate_credentials' then 'nodra_adapter'
                 when p_action_type='cancel_pending_jobs' then 'nodra_adapter'
                 else 'operator'
            end;

  if p_action_type='rotate_credentials' then
    if p_secret_hash is null or p_secret_prefix is null then
      raise exception 'rotation_secret_required';
    end if;

    select ic.id into v_old_credential_id
    from public.integration_credentials ic
    where ic.workspace_id=v_incident.workspace_id
      and ic.agent_id=v_origin.id
    order by ic.created_at desc
    limit 1;

    update public.integration_credentials ic
    set status='revoked',
        revoked_at=coalesce(ic.revoked_at,clock_timestamp())
    where ic.workspace_id=v_incident.workspace_id
      and ic.agent_id=v_origin.id
      and ic.status='active';

    insert into public.integration_credentials(
      workspace_id,agent_id,label,secret_hash,secret_prefix,status,
      created_by,rotated_from,created_at
    )
    values(
      v_incident.workspace_id,v_origin.id,'Recovery rotation',
      p_secret_hash,p_secret_prefix,'active',v_uid,v_old_credential_id,clock_timestamp()
    )
    returning id into v_new_credential_id;

    v_result:=pg_catalog.jsonb_build_object(
      'credentialId',v_new_credential_id,
      'secretPrefix',p_secret_prefix,
      'agentId',v_origin.external_id
    );
  elsif p_action_type='cancel_pending_jobs' then
    update public.gateway_outbox go
    set cancelled_at=clock_timestamp(),
        cancel_reason=trim(p_evidence_note)
    where go.workspace_id=v_incident.workspace_id
      and go.cancelled_at is null
      and go.delivered_at is null
      and go.agent_id in (
        select a.id
        from public.agents a
        join public.containment_actions ca
          on ca.workspace_id=a.workspace_id
         and ca.target_ref=a.external_id
        where ca.incident_id=p_incident_id
          and ca.action_type in ('quarantine_agent','restrict_authority')
      );

    get diagnostics v_cancelled=row_count;
    v_result:=pg_catalog.jsonb_build_object('cancelledNodraIntents',v_cancelled);
  else
    v_result:=pg_catalog.jsonb_build_object('evidenceNote',trim(p_evidence_note));
  end if;

  insert into public.remediation_actions(
    workspace_id,incident_id,action_type,target,status,requested_by,
    started_at,completed_at,result,provider
  )
  values(
    v_incident.workspace_id,p_incident_id,
    case when p_action_type='verify_origin_remediated' then 'patch_origin' else p_action_type end,
    v_origin.external_id,
    'succeeded',v_uid,clock_timestamp(),clock_timestamp(),v_result,
    'nodra-control-plane'
  )
  returning id into v_action_id;

  insert into public.remediation_evidence(
    workspace_id,incident_id,check_key,evidence_type,evidence_ref,
    details,verified_at,verified_by,source,adapter_action_id
  )
  values(
    v_incident.workspace_id,p_incident_id,v_check_key,
    case when v_source='operator' then 'operator-attestation' else 'adapter-success' end,
    v_action_id::text,
    v_result,
    clock_timestamp(),
    v_uid,
    v_source,
    v_action_id
  )
  returning id into v_evidence_id;

  v_checks:=coalesce(v_plan.restart_checks,'{}'::jsonb)
    || pg_catalog.jsonb_build_object(v_check_key,true);

  update public.recovery_plans rp
  set restart_checks=v_checks
  where rp.id=v_plan.id;

  update public.recovery_steps rs
  set status='ready',
      completed_at=clock_timestamp()
  where rs.recovery_plan_id=v_plan.id
    and rs.check_key=v_check_key;

  perform public.append_integration_security_event(
    v_incident.workspace_id,
    p_incident_id,
    v_origin.id,
    'recovery-remediation',
    'recovery.'||p_action_type,
    null,
    'allow',
    null,
    pg_catalog.jsonb_build_object(
      'checkKey',v_check_key,
      'remediationActionId',v_action_id,
      'evidenceId',v_evidence_id,
      'provider','nodra-control-plane',
      'result',v_result
    ),
    clock_timestamp()
  );

  return pg_catalog.jsonb_build_object(
    'actionId',v_action_id,
    'evidenceId',v_evidence_id,
    'checkKey',v_check_key,
    'restartChecks',v_checks,
    'result',v_result
  );
end;
$$;


revoke all on function public.run_customer_recovery_action(uuid,text,text,text,text) from public,anon;
grant execute on function public.run_customer_recovery_action(uuid,text,text,text,text) to authenticated;
