create or replace function public.append_integration_security_event(
  p_workspace_id uuid,p_incident_id uuid,p_agent_id uuid,p_event_type text,
  p_action text,p_resource_id uuid,p_decision text,p_caused_by_event_id uuid,
  p_payload jsonb,p_occurred_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_seq bigint; v_prev text; v_id uuid:=pg_catalog.gen_random_uuid(); v_hash text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text,0));
  select se.sequence_no,se.event_hash into v_seq,v_prev
  from public.security_events se
  where se.workspace_id=p_workspace_id
  order by se.sequence_no desc
  limit 1;
  v_seq:=coalesce(v_seq,0)+1;
  v_hash:=pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'id',v_id,'workspace_id',p_workspace_id,'incident_id',p_incident_id,
          'agent_id',p_agent_id,'event_type',p_event_type,'action',p_action,
          'resource_id',p_resource_id,'decision',p_decision,
          'caused_by_event_id',p_caused_by_event_id,'payload',coalesce(p_payload,'{}'::jsonb),
          'sequence_no',v_seq,'prev_hash',v_prev,'occurred_at',p_occurred_at
        )::text,'UTF8'
      ),'sha256'
    ),'hex'
  );
  insert into public.security_events(
    id,workspace_id,incident_id,agent_id,event_type,action,resource_id,
    decision,caused_by_event_id,payload,sequence_no,prev_hash,event_hash,occurred_at
  )
  values(
    v_id,p_workspace_id,p_incident_id,p_agent_id,p_event_type,p_action,p_resource_id,
    case when p_decision is null then null else p_decision::public.security_decision end,
    p_caused_by_event_id,coalesce(p_payload,'{}'::jsonb),v_seq,v_prev,v_hash,p_occurred_at
  );
  return v_id;
end;
$$;

revoke all on function public.append_integration_security_event(uuid,uuid,uuid,text,text,uuid,text,uuid,jsonb,timestamptz) from public,anon,authenticated;

create or replace function public.record_integration_gateway_event(
  p_secret_hash text,p_external_agent_id text,p_nonce text,
  p_request_timestamp timestamptz,p_expires_at timestamptz,p_request_id text,
  p_resource_external_id text,p_action text,p_decision text,p_phase text,
  p_executed boolean,p_outcome text,p_reason text,p_caused_by text,
  p_caused_by_event_id uuid,p_incident_id uuid,p_occurred_at timestamptz
)
returns table(event_id uuid,incident_id uuid,agent_id uuid,workspace_id uuid)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_credential public.integration_credentials%rowtype;
  v_agent public.agents%rowtype;
  v_resource_id uuid; v_incident_id uuid:=p_incident_id; v_event_id uuid;
  v_parent_agent_id uuid; v_bucket timestamptz; v_count integer;
  v_now timestamptz:=clock_timestamp(); v_payload jsonb;
begin
  select ic.* into v_credential
  from public.integration_credentials ic
  where ic.secret_hash=p_secret_hash and ic.status='active'
  limit 1;
  if v_credential.id is null then raise exception 'invalid_credential'; end if;

  select a.* into v_agent
  from public.agents a
  where a.id=v_credential.agent_id and a.workspace_id=v_credential.workspace_id
    and a.external_id=p_external_agent_id
  limit 1;
  if v_agent.id is null then raise exception 'invalid_credential'; end if;

  begin
    insert into public.gateway_request_nonces(workspace_id,agent_id,nonce,request_timestamp,expires_at)
    values(v_credential.workspace_id,v_agent.id,p_nonce,p_request_timestamp,p_expires_at);
  exception when unique_violation then
    raise exception 'gateway_request_replayed';
  end;

  v_bucket:=to_timestamp(floor(extract(epoch from v_now)/60)*60);
  insert into public.gateway_rate_limits(workspace_id,agent_id,bucket_start,request_count,updated_at)
  values(v_credential.workspace_id,v_agent.id,v_bucket,1,v_now)
  on conflict on constraint gateway_rate_limits_pkey
  do update set request_count=public.gateway_rate_limits.request_count+1,updated_at=excluded.updated_at
  returning public.gateway_rate_limits.request_count into v_count;
  if v_count>240 then raise exception 'gateway_event_rate_limit_exceeded'; end if;

  insert into public.resources(workspace_id,external_id,name,kind)
  values(v_credential.workspace_id,p_resource_external_id,p_resource_external_id,'runtime-tool')
  on conflict(workspace_id,external_id) do update set name=excluded.name
  returning id into v_resource_id;

  if v_incident_id is not null and not exists(
    select 1 from public.incidents i
    where i.id=v_incident_id and i.workspace_id=v_credential.workspace_id
  ) then raise exception 'incident_workspace_mismatch'; end if;

  if p_phase is distinct from 'intent'
     and p_decision in ('deny','require-approval')
     and v_incident_id is null then
    select i.id into v_incident_id
    from public.incidents i
    where i.workspace_id=v_credential.workspace_id
      and i.origin_agent_id=v_agent.id
      and i.state::text in ('open','contained','recovering')
      and i.metadata @> '{"source":"runtime-gateway"}'::jsonb
    order by i.opened_at desc limit 1;

    if v_incident_id is null then
      insert into public.incidents(workspace_id,origin_agent_id,title,severity,metadata)
      values(
        v_credential.workspace_id,v_agent.id,
        'Gateway policy '||p_decision||': '||p_action,
        case when p_decision='deny' then 'high' else 'medium' end,
        pg_catalog.jsonb_build_object(
          'source','runtime-gateway','triggerRequestId',p_request_id,
          'resourceId',p_resource_external_id,'triggerDecision',p_decision
        )
      ) returning id into v_incident_id;
    end if;
  end if;

  v_payload:=pg_catalog.jsonb_build_object(
    'gatewayRequestId',p_request_id,'phase',coalesce(p_phase,'result'),
    'outcome',p_outcome,'resourceId',p_resource_external_id,
    'executed',coalesce(p_executed,false),'reason',p_reason,
    'observedAt',p_occurred_at,'credentialId',v_credential.id
  );

  if p_phase='intent' then
    insert into public.gateway_outbox(workspace_id,incident_id,agent_id,request_id,phase,payload)
    values(v_credential.workspace_id,v_incident_id,v_agent.id,p_request_id,'intent',v_payload)
    on conflict(workspace_id,request_id,phase) do update set payload=excluded.payload;
  end if;

  v_event_id:=public.append_integration_security_event(
    v_credential.workspace_id,v_incident_id,v_agent.id,'gateway-tool-request',p_action,
    v_resource_id,case when p_decision='require-approval' then 'require_approval' else p_decision end,
    p_caused_by_event_id,v_payload,coalesce(p_occurred_at,v_now)
  );

  if p_caused_by is not null and length(trim(p_caused_by))>0 then
    select a.id into v_parent_agent_id
    from public.agents a
    where a.workspace_id=v_credential.workspace_id and a.external_id=p_caused_by
    limit 1;
    if v_parent_agent_id is not null and v_parent_agent_id<>v_agent.id then
      insert into public.causal_edges(
        workspace_id,incident_id,from_agent_id,to_agent_id,event_id,relation
      ) values(
        v_credential.workspace_id,v_incident_id,v_parent_agent_id,v_agent.id,v_event_id,'gateway-caused-by'
      );
    end if;
  end if;

  update public.integration_credentials ic set last_used_at=v_now where ic.id=v_credential.id;
  update public.agents a set last_seen_at=v_now where a.id=v_agent.id;
  return query select v_event_id,v_incident_id,v_agent.id,v_credential.workspace_id;
end;
$$;

revoke all on function public.record_integration_gateway_event(text,text,text,timestamptz,timestamptz,text,text,text,text,text,boolean,text,text,text,uuid,uuid,timestamptz) from public;
grant execute on function public.record_integration_gateway_event(text,text,text,timestamptz,timestamptz,text,text,text,text,text,boolean,text,text,text,uuid,uuid,timestamptz) to anon;
grant execute on function public.record_integration_gateway_event(text,text,text,timestamptz,timestamptz,text,text,text,text,text,boolean,text,text,text,uuid,uuid,timestamptz) to authenticated;

create or replace function public.execute_approved_integration_action(
  p_secret_hash text,p_external_agent_id text,p_nonce text,
  p_request_timestamp timestamptz,p_expires_at timestamptz,
  p_authorization_event_id uuid,p_execution_token_hash text,
  p_resource_external_id text,p_action text
)
returns table(
  agent_external_id text,authorization_event_id uuid,decision_id uuid,execution_event_id uuid
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_credential public.integration_credentials%rowtype;
  v_agent public.agents%rowtype;
  v_event public.security_events%rowtype;
  v_decision_id uuid; v_execution_event_id uuid;
  v_payload jsonb; v_now timestamptz:=clock_timestamp();
begin
  select ic.* into v_credential
  from public.integration_credentials ic
  where ic.secret_hash=p_secret_hash and ic.status='active'
  limit 1;
  if v_credential.id is null then raise exception 'invalid_credential'; end if;

  select a.* into v_agent
  from public.agents a
  where a.id=v_credential.agent_id and a.workspace_id=v_credential.workspace_id
    and a.external_id=p_external_agent_id
  limit 1;
  if v_agent.id is null then raise exception 'invalid_credential'; end if;
  if v_agent.status::text<>'healthy' then raise exception 'agent_not_healthy'; end if;

  begin
    insert into public.gateway_request_nonces(workspace_id,agent_id,nonce,request_timestamp,expires_at)
    values(v_credential.workspace_id,v_agent.id,p_nonce,p_request_timestamp,p_expires_at);
  exception when unique_violation then
    raise exception 'gateway_request_replayed';
  end;

  select e.* into v_event
  from public.security_events e
  where e.workspace_id=v_credential.workspace_id
    and e.id=p_authorization_event_id and e.agent_id=v_agent.id
    and e.decision='require_approval'
  limit 1;
  if v_event.id is null then raise exception 'approval_authorization_mismatch'; end if;

  v_payload:=case
    when v_event.payload is not null and jsonb_typeof(v_event.payload)='object' then v_event.payload
    else '{}'::jsonb
  end;

  if v_event.action is distinct from p_action
     or coalesce(v_payload->>'resourceId','')<>p_resource_external_id then
    raise exception 'approval_authorization_mismatch';
  end if;

  update public.approval_decisions d
  set consumed_at=v_now
  where d.workspace_id=v_credential.workspace_id and d.security_event_id=v_event.id
    and d.decision='approved' and d.execution_token_hash=p_execution_token_hash
    and d.consumed_at is null and d.execution_token_expires_at>v_now
  returning d.id into v_decision_id;
  if v_decision_id is null then raise exception 'approval_token_invalid_expired_or_consumed'; end if;

  v_execution_event_id:=public.append_integration_security_event(
    v_credential.workspace_id,v_event.incident_id,v_agent.id,'approved-execution',p_action,
    v_event.resource_id,'allow',v_event.id,
    pg_catalog.jsonb_build_object(
      'resourceId',p_resource_external_id,'authorizationEventId',v_event.id,
      'approvalDecisionId',v_decision_id,'credentialId',v_credential.id
    ),v_now
  );

  update public.integration_credentials ic set last_used_at=v_now where ic.id=v_credential.id;
  update public.agents a set last_seen_at=v_now where a.id=v_agent.id;
  return query select v_agent.external_id,v_event.id,v_decision_id,v_execution_event_id;
end;
$$;

revoke all on function public.execute_approved_integration_action(text,text,text,timestamptz,timestamptz,uuid,text,text,text) from public;
grant execute on function public.execute_approved_integration_action(text,text,text,timestamptz,timestamptz,uuid,text,text,text) to anon;
grant execute on function public.execute_approved_integration_action(text,text,text,timestamptz,timestamptz,uuid,text,text,text) to authenticated;
