alter table public.remediation_evidence add column if not exists source text not null default 'operator' check (source in ('operator','nodra_adapter'));
alter table public.remediation_evidence add column if not exists adapter_action_id uuid;
create table if not exists public.remediation_actions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 incident_id uuid not null references public.incidents(id) on delete cascade,
 action_type text not null check (action_type in ('patch_origin','rotate_credentials','review_memory','cancel_pending_jobs')),
 target text not null, status text not null default 'pending' check(status in ('pending','running','succeeded','failed')),
 requested_by uuid not null default auth.uid(), started_at timestamptz, completed_at timestamptz, result jsonb not null default '{}'::jsonb
);
alter table public.remediation_actions enable row level security;
create policy "members read remediation actions" on public.remediation_actions for select to authenticated using (exists(select 1 from public.workspace_members wm where wm.workspace_id=remediation_actions.workspace_id and wm.user_id=auth.uid()));
create policy "operators create remediation actions" on public.remediation_actions for insert to authenticated with check (exists(select 1 from public.workspace_members wm where wm.workspace_id=remediation_actions.workspace_id and wm.user_id=auth.uid() and wm.role in ('owner','admin','analyst')));
create policy "operators update remediation actions" on public.remediation_actions for update to authenticated using (exists(select 1 from public.workspace_members wm where wm.workspace_id=remediation_actions.workspace_id and wm.user_id=auth.uid() and wm.role in ('owner','admin','analyst'))) with check (exists(select 1 from public.workspace_members wm where wm.workspace_id=remediation_actions.workspace_id and wm.user_id=auth.uid() and wm.role in ('owner','admin','analyst')));
create or replace function public.refresh_recovery_evidence(p_incident_id uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare p public.recovery_plans; result jsonb; k text;
begin
 select * into p from public.recovery_plans where incident_id=p_incident_id;
 if p.id is null then raise exception 'recovery plan not found'; end if;
 if not exists(select 1 from public.workspace_members where workspace_id=p.workspace_id and user_id=auth.uid()) then raise exception 'workspace membership required'; end if;
 result=coalesce(p.restart_checks,'{}'::jsonb);
 foreach k in array array['originPatched','credentialsRotated','memoryReviewed','pendingJobsReviewed'] loop
   result=jsonb_set(result,array[k],to_jsonb(exists(select 1 from public.remediation_evidence e where e.incident_id=p_incident_id and e.check_key=k and e.source='nodra_adapter' and e.adapter_action_id is not null)),true);
 end loop;
 update public.recovery_plans set restart_checks=result where id=p.id;
 return result;
end $$;

