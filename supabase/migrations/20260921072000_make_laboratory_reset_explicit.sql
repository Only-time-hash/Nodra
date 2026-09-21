-- Make laboratory reset an explicit audited recovery exit instead of leaving
-- unresolved recovery work looking like a normal safe restart.
create or replace function public.reset_laboratory(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role workspace_role;
  v_count integer;
  v_skipped integer;
begin
  select role into v_role
  from public.workspace_members
  where workspace_id = p_workspace_id and user_id = auth.uid();

  if v_role is null then raise exception 'workspace access denied'; end if;
  if v_role not in ('owner','admin','analyst') then raise exception 'insufficient role'; end if;

  update public.recovery_steps rs
  set status = 'skipped',
      completed_at = coalesce(rs.completed_at, now()),
      reason = case
        when rs.reason like '%[laboratory reset]%' then rs.reason
        else rs.reason || ' [laboratory reset]'
      end
  from public.recovery_plans rp
  join public.incidents i on i.id = rp.incident_id
  where rs.recovery_plan_id = rp.id
    and rs.workspace_id = p_workspace_id
    and rp.workspace_id = p_workspace_id
    and i.workspace_id = p_workspace_id
    and i.metadata->>'source' = 'nodra-v0.1-lab'
    and i.state <> 'resolved'
    and rs.status not in ('ready','completed','skipped');
  get diagnostics v_skipped = row_count;

  update public.recovery_plans rp
  set safe_to_restart = false
  from public.incidents i
  where rp.incident_id = i.id
    and rp.workspace_id = p_workspace_id
    and i.workspace_id = p_workspace_id
    and i.metadata->>'source' = 'nodra-v0.1-lab'
    and i.state <> 'resolved';

  update public.incidents
  set state = 'resolved',
      resolved_at = coalesce(resolved_at, now()),
      metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'laboratory_reset_at', now(),
        'resolution_method', 'laboratory_reset'
      )
  where workspace_id = p_workspace_id
    and metadata->>'source' = 'nodra-v0.1-lab'
    and state <> 'resolved';
  get diagnostics v_count = row_count;

  update public.agents
  set status='healthy', authority_scope='{}'::jsonb
  where workspace_id=p_workspace_id and kind='laboratory';

  delete from public.laboratory_security_state where workspace_id=p_workspace_id;

  return jsonb_build_object(
    'reset', true,
    'incidents_resolved', v_count,
    'recovery_steps_skipped', v_skipped,
    'evidence_preserved', true,
    'resolution_method', 'laboratory_reset'
  );
end
$$;

revoke execute on function public.reset_laboratory(uuid) from public, anon;
grant execute on function public.reset_laboratory(uuid) to authenticated;
