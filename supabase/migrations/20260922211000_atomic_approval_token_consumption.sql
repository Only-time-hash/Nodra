create or replace function public.consume_approval_execution_token(
 p_workspace_id uuid,p_security_event_id uuid,p_token_hash text
) returns table(decision_id uuid,security_event_id uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.approval_decisions%rowtype;
begin
 update public.approval_decisions
 set consumed_at=now()
 where workspace_id=p_workspace_id and approval_decisions.security_event_id=p_security_event_id
   and decision='approved' and execution_token_hash=p_token_hash
   and consumed_at is null and execution_token_expires_at>now()
 returning * into v;
 if not found then return; end if;
 return query select v.id,v.security_event_id;
end $$;
revoke all on function public.consume_approval_execution_token(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.consume_approval_execution_token(uuid,uuid,text) to service_role;
