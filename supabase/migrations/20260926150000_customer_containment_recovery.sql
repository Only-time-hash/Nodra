alter table public.recovery_steps
  add column if not exists check_key text;

create unique index if not exists recovery_steps_plan_check_key_idx
  on public.recovery_steps(recovery_plan_id,check_key)
  where check_key is not null;

alter table public.gateway_outbox
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text;

create or replace function public.contain_customer_incident(p_incident_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_incident public.incidents%rowtype;
  v_role text;
  v_scope record;
  v_revoked integer:=0;
  v_targets integer:=0;
  v_action_type text;
  v_existing boolean;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;

  select i.* into v_incident
  from public.incidents i
  where i.id=p_incident_id
  for update;

  if v_incident.id is null then raise exception 'incident_not_found'; end if;
  if v_incident.state::text='resolved' then raise exception 'incident_already_resolved'; end if;
  if v_incident.origin_agent_id is null then raise exception 'incident_origin_missing'; end if;

  select wm.role::text into v_role
  from public.workspace_members wm
  where wm.workspace_id=v_incident.workspace_id
    and wm.user_id=v_uid
  limit 1;

  if v_role is null or v_role not in ('owner','admin','analyst') then
    raise exception 'insufficient_role';
  end if;

  for v_scope in
    select * from public.containment_scope(p_incident_id)
  loop
    v_targets:=v_targets+1;
    v_action_type:=case when v_scope.action='quarantine' then 'quarantine_agent' else 'restrict_authority' end;

    if v_scope.action='quarantine' then
      update public.agents a
      set status='quarantined',
          metadata=coalesce(a.metadata,'{}'::jsonb) || pg_catalog.jsonb_build_object(
            'containment',
            pg_catalog.jsonb_build_object(
              'incidentId',p_incident_id,
              'state','quarantined',
              'containedAt',clock_timestamp()
            )
          )
      where a.id=v_scope.agent_id
        and a.workspace_id=v_incident.workspace_id;

      update public.integration_credentials ic
      set status='revoked',
          revoked_at=coalesce(ic.revoked_at,clock_timestamp())
      where ic.workspace_id=v_incident.workspace_id
        and ic.agent_id=v_scope.agent_id
        and ic.status='active';

      get diagnostics v_revoked = row_count;
    else
      update public.agents a
      set status='at_risk',
          metadata=coalesce(a.metadata,'{}'::jsonb) || pg_catalog.jsonb_build_object(
            'containment',
            pg_catalog.jsonb_build_object(
              'incidentId',p_incident_id,
              'state','restricted',
              'containedAt',clock_timestamp()
            )
          )
      where a.id=v_scope.agent_id
        and a.workspace_id=v_incident.workspace_id;
    end if;

    select exists(
      select 1
      from public.containment_actions ca
      where ca.workspace_id=v_incident.workspace_id
        and ca.incident_id=p_incident_id
        and ca.action_type=v_action_type
        and ca.target_ref=v_scope.external_id
    ) into v_existing;

    if not v_existing then
      insert into public.containment_actions(
        workspace_id,incident_id,action_type,target_type,target_ref,
        requested_by,reason,result
      )
      values(
        v_incident.workspace_id,
        p_incident_id,
        v_action_type,
        'agent',
        v_scope.external_id,
        v_uid,
        case when v_scope.action='quarantine'
          then 'Incident origin isolated by Nodra control plane'
          else 'Causal descendant restricted by evidence-derived containment scope'
        end,
        pg_catalog.jsonb_build_object(
          'depth',v_scope.depth,
          'credentialRevocationApplied',v_scope.action='quarantine'
        )
      );
    end if;

    perform public.append_integration_security_event(
      v_incident.workspace_id,
      p_incident_id,
      v_scope.agent_id,
      'containment-action',
      case when v_scope.action='quarantine' then 'agent.quarantine' else 'agent.restrict' end,
      null,
      'deny',
      null,
      pg_catalog.jsonb_build_object(
        'target',v_scope.external_id,
        'depth',v_scope.depth,
        'containmentAction',v_action_type
      ),
      clock_timestamp()
    );
  end loop;

  if v_targets=0 then raise exception 'containment_scope_empty'; end if;

  update public.incidents i
  set state='contained',
      contained_at=coalesce(i.contained_at,clock_timestamp())
  where i.id=p_incident_id
    and i.workspace_id=v_incident.workspace_id
    and i.state::text in ('open','contained');

  return pg_catalog.jsonb_build_object(
    'incidentId',p_incident_id,
    'state','contained',
    'affectedAgents',v_targets,
    'originCredentialsRevoked',v_revoked
  );
end;
$$;

revoke all on function public.contain_customer_incident(uuid) from public,anon;
grant execute on function public.contain_customer_incident(uuid) to authenticated;

create or replace function public.start_customer_recovery(p_incident_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_incident public.incidents%rowtype;
  v_role text;
  v_plan_id uuid;
  v_checks jsonb:=pg_catalog.jsonb_build_object(
    'originPatched',false,
    'credentialsRotated',false,
    'memoryReviewed',false,
    'pendingJobsReviewed',false,
    'humanApproved',false
  );
begin
  if v_uid is null then raise exception 'authentication_required'; end if;

  select i.* into v_incident
  from public.incidents i
  where i.id=p_incident_id
  for update;

  if v_incident.id is null then raise exception 'incident_not_found'; end if;
  if v_incident.state::text not in ('contained','recovering') then
    raise exception 'containment_required_before_recovery';
  end if;

  select wm.role::text into v_role
  from public.workspace_members wm
  where wm.workspace_id=v_incident.workspace_id
    and wm.user_id=v_uid
  limit 1;

  if v_role is null or v_role not in ('owner','admin','analyst') then
    raise exception 'insufficient_role';
  end if;

  insert into public.recovery_plans(workspace_id,incident_id,safe_to_restart,restart_checks)
  values(v_incident.workspace_id,p_incident_id,false,v_checks)
  on conflict(incident_id)
  do update set safe_to_restart=false
  returning id into v_plan_id;

  insert into public.recovery_steps(
    workspace_id,recovery_plan_id,check_key,title,reason,requires_human,status
  )
  values
    (
      v_incident.workspace_id,v_plan_id,'originPatched',
      'Verify incident origin remediation',
      'Confirm the external origin condition that caused the incident has been removed or patched.',
      true,'pending'
    ),
    (
      v_incident.workspace_id,v_plan_id,'credentialsRotated',
      'Rotate origin agent credential',
      'Issue a new runtime credential after containment revoked the origin credential.',
      false,'pending'
    ),
    (
      v_incident.workspace_id,v_plan_id,'memoryReviewed',
      'Review affected runtime memory and state',
      'Confirm prompts, memory, caches, files or state touched during the incident are safe.',
      true,'pending'
    ),
    (
      v_incident.workspace_id,v_plan_id,'pendingJobsReviewed',
      'Review and cancel pending work',
      'Cancel Nodra queued intents and confirm external queued work has been reviewed.',
      true,'pending'
    )
  on conflict(recovery_plan_id,check_key) where check_key is not null
  do nothing;

  update public.incidents i
  set state='recovering'
  where i.id=p_incident_id
    and i.workspace_id=v_incident.workspace_id
    and i.state::text='contained';

  return pg_catalog.jsonb_build_object(
    'incidentId',p_incident_id,
    'recoveryPlanId',v_plan_id,
    'state','recovering',
    'restartChecks',v_checks
  );
end;
$$;

revoke all on function public.start_customer_recovery(uuid) from public,anon;
grant execute on function public.start_customer_recovery(uuid) to authenticated;

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
      created_by,rotated_from
    )
    values(
      v_incident.workspace_id,v_origin.id,'Recovery rotation',
      p_secret_hash,p_secret_prefix,'active',v_uid,v_old_credential_id
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
    v_incident.workspace_id,p_incident_id,p_action_type,v_origin.external_id,
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

create or replace function public.complete_incident_restart(p_incident_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_workspace uuid;
  v_origin_agent uuid;
  v_plan uuid;
  v_checks jsonb;
  v_pending bigint;
  v_contained_at timestamptz;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;

  select i.workspace_id,i.origin_agent_id,i.contained_at
    into v_workspace,v_origin_agent,v_contained_at
  from public.incidents i
  where i.id=p_incident_id
    and i.state::text='recovering'
  for update;

  if v_workspace is null then return false; end if;

  if not exists(
    select 1
    from public.workspace_members wm
    where wm.workspace_id=v_workspace
      and wm.user_id=v_uid
      and wm.role::text in ('owner','admin')
  ) then raise exception 'owner_or_admin_restart_required'; end if;

  select rp.id,rp.restart_checks into v_plan,v_checks
  from public.recovery_plans rp
  where rp.incident_id=p_incident_id
    and rp.workspace_id=v_workspace
  for update;

  if v_plan is null then return false; end if;

  select count(*) into v_pending
  from public.recovery_steps rs
  where rs.recovery_plan_id=v_plan
    and rs.status::text not in ('ready','completed');

  if v_pending<>0 then return false; end if;

  if not (
    coalesce((v_checks->>'originPatched')::boolean,false)
    and coalesce((v_checks->>'credentialsRotated')::boolean,false)
    and coalesce((v_checks->>'memoryReviewed')::boolean,false)
    and coalesce((v_checks->>'pendingJobsReviewed')::boolean,false)
    and coalesce((v_checks->>'humanApproved')::boolean,false)
  ) then return false; end if;

  if not exists(
    select 1
    from public.integration_credentials ic
    where ic.workspace_id=v_workspace
      and ic.agent_id=v_origin_agent
      and ic.status='active'
      and (v_contained_at is null or ic.created_at>=v_contained_at)
  ) then return false; end if;

  update public.recovery_plans
  set safe_to_restart=true
  where id=v_plan;

  update public.recovery_steps
  set status='completed',
      completed_at=coalesce(completed_at,clock_timestamp())
  where recovery_plan_id=v_plan
    and status::text='ready';

  update public.agents a
  set status='healthy',
      metadata=coalesce(a.metadata,'{}'::jsonb) - 'containment'
  where a.workspace_id=v_workspace
    and a.external_id in (
      select ca.target_ref
      from public.containment_actions ca
      where ca.workspace_id=v_workspace
        and ca.incident_id=p_incident_id
        and ca.action_type in ('quarantine_agent','restrict_authority')
    )
    and a.status::text in ('quarantined','at_risk','paused');

  update public.incidents i
  set state='resolved',
      resolved_at=clock_timestamp()
  where i.id=p_incident_id
    and i.workspace_id=v_workspace
    and i.state::text='recovering';

  if not found then raise exception 'incident_resolution_failed'; end if;

  perform public.append_integration_security_event(
    v_workspace,
    p_incident_id,
    v_origin_agent,
    'safe-restart',
    'agent.restart',
    null,
    'allow',
    null,
    pg_catalog.jsonb_build_object(
      'recoveryPlanId',v_plan,
      'restartChecks',v_checks,
      'approvedBy',v_uid
    ),
    clock_timestamp()
  );

  return true;
end;
$$;

revoke all on function public.complete_incident_restart(uuid) from public,anon;
grant execute on function public.complete_incident_restart(uuid) to authenticated;
