create table if not exists public.remediation_evidence (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 incident_id uuid not null references public.incidents(id) on delete cascade, check_key text not null check (check_key in ('originPatched','credentialsRotated','memoryReviewed','pendingJobsReviewed')),
 evidence_type text not null, evidence_ref text not null, details jsonb not null default '{}'::jsonb, verified_at timestamptz not null default now(), verified_by uuid default auth.uid(),
 unique(incident_id,check_key,evidence_ref)
);
alter table public.remediation_evidence enable row level security;
create policy "members read remediation evidence" on public.remediation_evidence for select to authenticated using (exists(select 1 from public.workspace_members wm where wm.workspace_id=remediation_evidence.workspace_id and wm.user_id=auth.uid()));
create policy "analysts record remediation evidence" on public.remediation_evidence for insert to authenticated with check (exists(select 1 from public.workspace_members wm where wm.workspace_id=remediation_evidence.workspace_id and wm.user_id=auth.uid() and wm.role in ('owner','admin','analyst')));
create or replace function public.refresh_recovery_evidence(p_incident_id uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare p public.recovery_plans; result jsonb; k text;
begin
 select * into p from public.recovery_plans where incident_id=p_incident_id;
 if p.id is null then raise exception 'recovery plan not found'; end if;
 if not exists(select 1 from public.workspace_members where workspace_id=p.workspace_id and user_id=auth.uid()) then raise exception 'workspace membership required'; end if;
 result=coalesce(p.restart_checks,'{}'::jsonb);
 foreach k in array array['originPatched','credentialsRotated','memoryReviewed','pendingJobsReviewed'] loop
   result=jsonb_set(result,array[k],to_jsonb(exists(select 1 from public.remediation_evidence e where e.incident_id=p_incident_id and e.check_key=k)),true);
 end loop;
 update public.recovery_plans set restart_checks=result where id=p.id;
 return result;
end $$;
revoke all on function public.refresh_recovery_evidence(uuid) from public;
grant execute on function public.refresh_recovery_evidence(uuid) to authenticated;

