
alter table public.remediation_evidence
  drop constraint if exists remediation_evidence_adapter_action_id_fkey;
alter table public.remediation_evidence
  add constraint remediation_evidence_adapter_action_id_fkey
  foreign key (adapter_action_id) references public.remediation_actions(id) on delete cascade;

drop policy if exists "analysts record remediation evidence" on public.remediation_evidence;
create policy "operators record operator evidence"
on public.remediation_evidence for insert to authenticated
with check (
  source='operator' and adapter_action_id is null
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id=remediation_evidence.workspace_id
      and wm.user_id=auth.uid()
      and wm.role in ('owner','admin','analyst')
  )
);

drop policy if exists "operators update remediation actions" on public.remediation_actions;

create or replace function public.refresh_recovery_evidence(p_incident_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare p public.recovery_plans; result jsonb; k text;
begin
 select * into p from public.recovery_plans where incident_id=p_incident_id;
 if p.id is null then raise exception 'recovery plan not found'; end if;
 if not exists(select 1 from public.workspace_members where workspace_id=p.workspace_id and user_id=auth.uid()) then raise exception 'workspace membership required'; end if;
 result=coalesce(p.restart_checks,'{}'::jsonb);
 foreach k in array array['originPatched','credentialsRotated','memoryReviewed','pendingJobsReviewed'] loop
   result=jsonb_set(result,array[k],to_jsonb(exists(
     select 1
     from public.remediation_evidence e
     join public.remediation_actions a on a.id=e.adapter_action_id
     where e.incident_id=p_incident_id
       and e.workspace_id=p.workspace_id
       and e.check_key=k
       and e.source='nodra_adapter'
       and a.incident_id=e.incident_id
       and a.workspace_id=e.workspace_id
       and a.status='succeeded'
       and (
         (k='originPatched' and a.action_type='patch_origin') or
         (k='credentialsRotated' and a.action_type='rotate_credentials') or
         (k='memoryReviewed' and a.action_type='review_memory') or
         (k='pendingJobsReviewed' and a.action_type='cancel_pending_jobs')
       )
   )),true);
 end loop;
 update public.recovery_plans set restart_checks=result where id=p.id;
 return result;
end $$;

create or replace function public.run_laboratory_remediation(
  p_incident_id uuid,
  p_action_type text,
  p_target text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_workspace uuid;
  v_action uuid;
  v_check text;
  v_checks jsonb;
begin
  if p_action_type not in ('patch_origin','rotate_credentials','review_memory','cancel_pending_jobs') then
    raise exception 'unsupported remediation action';
  end if;
  select workspace_id into v_workspace from public.incidents
    where id=p_incident_id and state in ('contained','recovering');
  if v_workspace is null then raise exception 'incident is not ready for remediation'; end if;
  if not exists(
    select 1 from public.workspace_members wm
    where wm.workspace_id=v_workspace and wm.user_id=auth.uid()
      and wm.role in ('owner','admin','analyst')
  ) then raise exception 'operator role required'; end if;

  v_check := case p_action_type
    when 'patch_origin' then 'originPatched'
    when 'rotate_credentials' then 'credentialsRotated'
    when 'review_memory' then 'memoryReviewed'
    when 'cancel_pending_jobs' then 'pendingJobsReviewed'
  end;

  insert into public.remediation_actions
    (workspace_id,incident_id,action_type,target,status,requested_by,started_at,completed_at,result)
  values
    (v_workspace,p_incident_id,p_action_type,p_target,'succeeded',auth.uid(),now(),now(),
     jsonb_build_object('adapter','nodra-laboratory','verified',true,'actionType',p_action_type,'target',p_target))
  returning id into v_action;

  insert into public.remediation_evidence
    (workspace_id,incident_id,check_key,evidence_type,evidence_ref,details,verified_at,verified_by,source,adapter_action_id)
  values
    (v_workspace,p_incident_id,v_check,'adapter-success','lab-action:'||v_action::text,
     jsonb_build_object('adapter','nodra-laboratory','verified',true,'actionType',p_action_type,'target',p_target),
     now(),auth.uid(),'nodra_adapter',v_action);

  v_checks := public.refresh_recovery_evidence(p_incident_id);
  return jsonb_build_object('actionId',v_action,'checkKey',v_check,'restartChecks',v_checks);
end $$;

revoke all on function public.run_laboratory_remediation(uuid,text,text) from public;
grant execute on function public.run_laboratory_remediation(uuid,text,text) to authenticated;

