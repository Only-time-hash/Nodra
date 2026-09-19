create or replace function public.reset_laboratory(p_workspace_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role workspace_role; v_count integer;
begin
 select role into v_role from public.workspace_members where workspace_id=p_workspace_id and user_id=auth.uid();
 if v_role is null then raise exception 'workspace access denied'; end if;
 if v_role not in ('owner','admin','analyst') then raise exception 'insufficient role'; end if;
 update public.incidents
 set state='resolved', resolved_at=coalesce(resolved_at,now()),
     metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('laboratory_reset_at',now())
 where workspace_id=p_workspace_id and metadata->>'source'='nodra-v0.1-lab' and state<>'resolved';
 get diagnostics v_count=row_count;
 update public.agents set status='healthy',authority_scope='{}'::jsonb where workspace_id=p_workspace_id and kind='laboratory';
 delete from public.laboratory_security_state where workspace_id=p_workspace_id;
 return jsonb_build_object('reset',true,'incidents_resolved',v_count,'evidence_preserved',true);
end $$;
revoke execute on function public.reset_laboratory(uuid) from public,anon;
grant execute on function public.reset_laboratory(uuid) to authenticated;

