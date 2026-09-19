create or replace function public.sync_recovery_steps_for_incident(p_incident_id uuid,p_action_type text)
returns void language plpgsql security definer set search_path=public as $$
declare v_workspace uuid; v_plan uuid; v_pattern text;
begin
 select workspace_id into v_workspace from incidents where id=p_incident_id;
 if v_workspace is null or not exists(select 1 from workspace_members where workspace_id=v_workspace and user_id=auth.uid() and role in ('owner','admin','analyst')) then raise exception 'not_authorized'; end if;
 select id into v_plan from recovery_plans where incident_id=p_incident_id order by created_at desc limit 1;
 if v_plan is null then return; end if;
 v_pattern:=case p_action_type when 'patch_origin' then '%patch%' when 'rotate_credentials' then '%credential%' when 'review_memory' then '%memory%' when 'cancel_pending_jobs' then '%job%' end;
 update recovery_steps set status='completed',completed_at=now() where recovery_plan_id=v_plan and lower(title) like v_pattern;
end $$;
revoke all on function public.sync_recovery_steps_for_incident(uuid,text) from public,anon;
grant execute on function public.sync_recovery_steps_for_incident(uuid,text) to authenticated;

