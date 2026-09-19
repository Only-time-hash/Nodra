create or replace function public.append_security_event(
 p_workspace_id uuid,p_incident_id uuid,p_agent_id uuid,p_event_type text,p_action text default null,p_resource_id uuid default null,p_decision security_decision default null,p_caused_by_event_id uuid default null,p_payload jsonb default '{}'::jsonb,p_occurred_at timestamptz default now()
) returns public.security_events
language plpgsql security invoker set search_path=public,extensions as $$
declare v_seq bigint; v_prev text; v_id uuid:=gen_random_uuid(); v_hash text; v_row public.security_events;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 if not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()) then raise exception 'workspace access denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text,0));
 select sequence_no,event_hash into v_seq,v_prev from public.security_events where workspace_id=p_workspace_id order by sequence_no desc limit 1;
 v_seq:=coalesce(v_seq,0)+1;
 v_hash:=encode(digest(convert_to(jsonb_build_object('id',v_id,'workspace_id',p_workspace_id,'incident_id',p_incident_id,'agent_id',p_agent_id,'event_type',p_event_type,'action',p_action,'resource_id',p_resource_id,'decision',p_decision,'caused_by_event_id',p_caused_by_event_id,'payload',coalesce(p_payload,'{}'::jsonb),'sequence_no',v_seq,'prev_hash',v_prev,'occurred_at',p_occurred_at)::text,'UTF8'),'sha256'),'hex');
 insert into public.security_events(id,workspace_id,incident_id,agent_id,event_type,action,resource_id,decision,caused_by_event_id,payload,sequence_no,prev_hash,event_hash,occurred_at)
 values(v_id,p_workspace_id,p_incident_id,p_agent_id,p_event_type,p_action,p_resource_id,p_decision,p_caused_by_event_id,coalesce(p_payload,'{}'::jsonb),v_seq,v_prev,v_hash,p_occurred_at) returning * into v_row;
 return v_row;
end $$;
revoke all on function public.append_security_event(uuid,uuid,uuid,text,text,uuid,security_decision,uuid,jsonb,timestamptz) from public;
grant execute on function public.append_security_event(uuid,uuid,uuid,text,text,uuid,security_decision,uuid,jsonb,timestamptz) to authenticated;

