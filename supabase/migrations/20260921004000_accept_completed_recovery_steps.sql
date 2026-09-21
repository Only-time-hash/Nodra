-- A remediation adapter marks verified steps completed. Restart accepts both ready and completed states.
create or replace function public.complete_incident_restart(p_incident_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_workspace uuid; v_plan uuid; v_checks jsonb; v_pending bigint;
begin
 if v_uid is null then raise exception 'authentication_required'; end if;
 select i.workspace_id into v_workspace from public.incidents i where i.id=p_incident_id and i.state='recovering' for update;
 if v_workspace is null then return false; end if;
 if not exists(select 1 from public.workspace_members wm where wm.workspace_id=v_workspace and wm.user_id=v_uid and wm.role::text in ('owner','admin')) then raise exception 'owner_or_admin_restart_required'; end if;
 select rp.id,rp.restart_checks into v_plan,v_checks from public.recovery_plans rp where rp.incident_id=p_incident_id and rp.workspace_id=v_workspace for update;
 if v_plan is null then return false; end if;
 select count(*) into v_pending from public.recovery_steps rs where rs.recovery_plan_id=v_plan and rs.status::text not in ('ready','completed');
 if v_pending<>0 then return false; end if;
 if not (coalesce((v_checks->>'originPatched')::boolean,false) and coalesce((v_checks->>'credentialsRotated')::boolean,false) and coalesce((v_checks->>'memoryReviewed')::boolean,false) and coalesce((v_checks->>'pendingJobsReviewed')::boolean,false) and coalesce((v_checks->>'humanApproved')::boolean,false)) then return false; end if;
 update public.recovery_plans set safe_to_restart=true where id=v_plan;
 update public.agents set status='healthy' where workspace_id=v_workspace and kind='laboratory' and status in ('quarantined','at_risk');
 update public.incidents set state='resolved',resolved_at=now() where id=p_incident_id and workspace_id=v_workspace and state='recovering';
 if not found then raise exception 'incident_resolution_failed'; end if;
 return true;
end; $$;
revoke all on function public.complete_incident_restart(uuid) from public,anon;
grant execute on function public.complete_incident_restart(uuid) to authenticated;
