alter table public.recovery_plans
add column if not exists restart_checks jsonb not null default '{"originPatched":false,"credentialsRotated":false,"memoryReviewed":false,"pendingJobsReviewed":false,"humanApproved":false}'::jsonb;

create or replace function public.assess_incident_restart(p_incident_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare c jsonb; ok boolean;
begin
 select restart_checks into c from public.recovery_plans where incident_id=p_incident_id;
 if c is null then return false; end if;
 ok := coalesce((c->>'originPatched')::boolean,false)
   and coalesce((c->>'credentialsRotated')::boolean,false)
   and coalesce((c->>'memoryReviewed')::boolean,false)
   and coalesce((c->>'pendingJobsReviewed')::boolean,false)
   and coalesce((c->>'humanApproved')::boolean,false);
 update public.recovery_plans set safe_to_restart=ok where incident_id=p_incident_id;
 return ok;
end; $$;
revoke all on function public.assess_incident_restart(uuid) from public;
grant execute on function public.assess_incident_restart(uuid) to authenticated;

