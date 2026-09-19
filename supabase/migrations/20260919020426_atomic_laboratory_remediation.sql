create or replace function public.run_laboratory_remediation_atomic(
  p_incident_id uuid,
  p_action_type text,
  p_target text default 'laboratory'
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_workspace uuid;
  v_role text;
  v_state jsonb;
  v_result jsonb;
begin
  select workspace_id into v_workspace from public.incidents where id=p_incident_id;
  if v_workspace is null then raise exception 'incident_not_found'; end if;
  select role::text into v_role from public.workspace_members where workspace_id=v_workspace and user_id=auth.uid();
  if v_role is null or v_role not in ('owner','admin','analyst') then raise exception 'insufficient_role'; end if;
  v_state := public.apply_laboratory_remediation_state(v_workspace,p_action_type);
  v_result := public.run_laboratory_remediation(p_incident_id,p_action_type,p_target);
  perform public.sync_recovery_steps_for_incident(p_incident_id,p_action_type);
  return coalesce(v_result,'{}'::jsonb) || jsonb_build_object('laboratoryState',v_state);
end;
$$;
revoke execute on function public.run_laboratory_remediation_atomic(uuid,text,text) from public;
revoke execute on function public.run_laboratory_remediation_atomic(uuid,text,text) from anon;
grant execute on function public.run_laboratory_remediation_atomic(uuid,text,text) to authenticated;

