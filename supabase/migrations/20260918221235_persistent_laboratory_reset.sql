create or replace function public.reset_laboratory(p_workspace_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_role workspace_role; v_incidents uuid[];
begin
 select role into v_role from public.workspace_members where workspace_id=p_workspace_id and user_id=auth.uid();
 if v_role is null then raise exception 'workspace access denied'; end if;
 if v_role not in ('owner','admin','analyst') then raise exception 'insufficient role'; end if;
 select coalesce(array_agg(id),'{}'::uuid[]) into v_incidents from public.incidents where workspace_id=p_workspace_id and metadata->>'source'='nodra-v0.1-lab';
 delete from public.recovery_steps where workspace_id=p_workspace_id and recovery_plan_id in (select id from public.recovery_plans where incident_id=any(v_incidents));
 delete from public.recovery_plans where workspace_id=p_workspace_id and incident_id=any(v_incidents);
 delete from public.containment_actions where workspace_id=p_workspace_id and incident_id=any(v_incidents);
 delete from public.incident_affected_entities where workspace_id=p_workspace_id and incident_id=any(v_incidents);
 delete from public.causal_edges where workspace_id=p_workspace_id and incident_id=any(v_incidents);
 delete from public.security_events where workspace_id=p_workspace_id and incident_id=any(v_incidents);
 delete from public.incidents where workspace_id=p_workspace_id and id=any(v_incidents);
 update public.agents set status='healthy',authority_scope='{}'::jsonb where workspace_id=p_workspace_id and kind='laboratory';
 return jsonb_build_object('reset',true,'incidents_removed',cardinality(v_incidents));
end $$;
revoke all on function public.reset_laboratory(uuid) from public;
grant execute on function public.reset_laboratory(uuid) to authenticated;

