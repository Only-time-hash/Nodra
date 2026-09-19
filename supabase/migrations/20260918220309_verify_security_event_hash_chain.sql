create or replace function public.verify_security_event_chain(p_workspace_id uuid)
returns table(valid boolean, checked_events bigint, first_bad_sequence bigint, reason text)
language plpgsql security invoker set search_path=public,extensions as $$
declare r public.security_events; expected_seq bigint:=1; expected_prev text:=null; calculated text; count_checked bigint:=0;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 if not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()) then raise exception 'workspace access denied'; end if;
 for r in select * from public.security_events where workspace_id=p_workspace_id order by sequence_no loop
   if r.sequence_no<>expected_seq then return query select false,count_checked,r.sequence_no,'sequence_gap'; return; end if;
   if r.prev_hash is distinct from expected_prev then return query select false,count_checked,r.sequence_no,'previous_hash_mismatch'; return; end if;
   calculated:=encode(digest(convert_to(jsonb_build_object('id',r.id,'workspace_id',r.workspace_id,'incident_id',r.incident_id,'agent_id',r.agent_id,'event_type',r.event_type,'action',r.action,'resource_id',r.resource_id,'decision',r.decision,'caused_by_event_id',r.caused_by_event_id,'payload',r.payload,'sequence_no',r.sequence_no,'prev_hash',r.prev_hash,'occurred_at',r.occurred_at)::text,'UTF8'),'sha256'),'hex');
   if calculated<>r.event_hash then return query select false,count_checked,r.sequence_no,'event_hash_mismatch'; return; end if;
   count_checked:=count_checked+1; expected_seq:=expected_seq+1; expected_prev:=r.event_hash;
 end loop;
 return query select true,count_checked,null::bigint,null::text;
end $$;
revoke all on function public.verify_security_event_chain(uuid) from public;
grant execute on function public.verify_security_event_chain(uuid) to authenticated;

