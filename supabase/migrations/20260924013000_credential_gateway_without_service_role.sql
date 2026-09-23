create or replace function public.authorize_integration_gateway(
  p_secret_hash text,
  p_external_agent_id text,
  p_nonce text,
  p_request_timestamp timestamptz,
  p_expires_at timestamptz,
  p_resource_id text,
  p_action text
)
returns table (
  decision text,
  reason text,
  agent_external_id text,
  authorization_event_id uuid,
  workspace_id uuid,
  agent_id uuid,
  credential_id uuid,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_credential public.integration_credentials%rowtype;
  v_agent public.agents%rowtype;
  v_bucket timestamptz;
  v_count integer;
  v_now timestamptz := clock_timestamp();
  v_allowed text[];
  v_decision text;
  v_reason text;
  v_event_id uuid := pg_catalog.gen_random_uuid();
  v_seq bigint;
  v_prev text;
  v_hash text;
begin
  select ic.*
    into v_credential
  from public.integration_credentials ic
  where ic.secret_hash = p_secret_hash
    and ic.status = 'active'
  limit 1;

  if v_credential.id is null then
    raise exception 'invalid_credential';
  end if;

  select a.*
    into v_agent
  from public.agents a
  where a.id = v_credential.agent_id
    and a.workspace_id = v_credential.workspace_id
    and a.external_id = p_external_agent_id
  limit 1;

  if v_agent.id is null then
    raise exception 'invalid_credential';
  end if;

  begin
    insert into public.gateway_request_nonces(
      workspace_id,agent_id,nonce,request_timestamp,expires_at
    )
    values(
      v_credential.workspace_id,v_agent.id,p_nonce,p_request_timestamp,p_expires_at
    );
  exception when unique_violation then
    raise exception 'gateway_request_replayed';
  end;

  v_bucket := to_timestamp(floor(extract(epoch from v_now)/60)*60);

  insert into public.gateway_rate_limits(
    workspace_id,agent_id,bucket_start,request_count,updated_at
  )
  values(v_credential.workspace_id,v_agent.id,v_bucket,1,v_now)
  on conflict(workspace_id,agent_id,bucket_start)
  do update set
    request_count=public.gateway_rate_limits.request_count+1,
    updated_at=excluded.updated_at
  returning request_count into v_count;

  if v_count > 240 then
    raise exception 'authorization_rate_limit_exceeded';
  end if;

  if jsonb_typeof(v_agent.authority_scope) = 'array' then
    select coalesce(array_agg(value),array[]::text[])
      into v_allowed
    from jsonb_array_elements_text(v_agent.authority_scope);
  elsif jsonb_typeof(v_agent.authority_scope) = 'object' then
    select coalesce(array_agg(key),array[]::text[])
      into v_allowed
    from jsonb_each(v_agent.authority_scope)
    where value = 'true'::jsonb;
  else
    v_allowed := array[]::text[];
  end if;

  if v_agent.status::text <> 'healthy' then
    v_decision := 'deny';
    v_reason := 'agent_not_healthy';
  elsif '*' = any(v_allowed)
     or p_action = any(v_allowed)
     or p_resource_id = any(v_allowed)
     or (p_resource_id || ':' || p_action) = any(v_allowed) then
    v_decision := 'allow';
    v_reason := 'authority_scope_allows';
  else
    v_decision := 'require_approval';
    v_reason := 'outside_explicit_authority';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_credential.workspace_id::text,0)
  );

  select sequence_no,event_hash
    into v_seq,v_prev
  from public.security_events
  where workspace_id=v_credential.workspace_id
  order by sequence_no desc
  limit 1;

  v_seq := coalesce(v_seq,0)+1;

  v_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'id',v_event_id,
          'workspace_id',v_credential.workspace_id,
          'incident_id',null,
          'agent_id',v_agent.id,
          'event_type','gateway-authorization',
          'action',p_action,
          'resource_id',null,
          'decision',v_decision,
          'caused_by_event_id',null,
          'payload',pg_catalog.jsonb_build_object(
            'resourceId',p_resource_id,
            'reason',v_reason,
            'credentialId',v_credential.id
          ),
          'sequence_no',v_seq,
          'prev_hash',v_prev,
          'occurred_at',v_now
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.security_events(
    id,workspace_id,incident_id,agent_id,event_type,action,resource_id,
    decision,caused_by_event_id,payload,sequence_no,prev_hash,event_hash,occurred_at
  )
  values(
    v_event_id,v_credential.workspace_id,null,v_agent.id,'gateway-authorization',
    p_action,null,v_decision::public.security_decision,null,
    pg_catalog.jsonb_build_object(
      'resourceId',p_resource_id,
      'reason',v_reason,
      'credentialId',v_credential.id
    ),
    v_seq,v_prev,v_hash,v_now
  );

  update public.integration_credentials
  set last_used_at=v_now
  where id=v_credential.id;

  update public.agents
  set last_seen_at=v_now
  where id=v_agent.id;

  return query select
    v_decision,
    v_reason,
    v_agent.external_id,
    v_event_id,
    v_credential.workspace_id,
    v_agent.id,
    v_credential.id,
    greatest(240-v_count,0),
    greatest(1,ceil(extract(epoch from(v_bucket+interval '60 seconds'-v_now)))::integer);
end;
$$;

revoke all on function public.authorize_integration_gateway(text,text,text,timestamptz,timestamptz,text,text) from public;
grant execute on function public.authorize_integration_gateway(text,text,text,timestamptz,timestamptz,text,text) to anon;
grant execute on function public.authorize_integration_gateway(text,text,text,timestamptz,timestamptz,text,text) to authenticated;

create or replace function public.integration_connection_status(
  p_agent_external_id text
)
returns table (
  credential_id uuid,
  last_used_at timestamptz,
  agent_id uuid,
  agent_status text,
  authority_scope jsonb,
  event_id uuid,
  event_occurred_at timestamptz,
  event_decision text,
  event_type text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_workspace_id uuid;
  v_agent public.agents%rowtype;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  select wm.workspace_id
    into v_workspace_id
  from public.workspace_members wm
  where wm.user_id=v_uid
  order by wm.workspace_id
  limit 1;

  if v_workspace_id is null then
    raise exception 'workspace_required';
  end if;

  select a.*
    into v_agent
  from public.agents a
  where a.workspace_id=v_workspace_id
    and a.external_id=p_agent_external_id
  limit 1;

  if v_agent.id is null then
    raise exception 'unknown_agent';
  end if;

  return query
  select
    ic.id,
    ic.last_used_at,
    v_agent.id,
    v_agent.status::text,
    v_agent.authority_scope,
    se.id,
    se.occurred_at,
    se.decision::text,
    se.event_type
  from (select 1) seed
  left join lateral (
    select x.id,x.last_used_at
    from public.integration_credentials x
    where x.workspace_id=v_workspace_id
      and x.agent_id=v_agent.id
      and x.status='active'
    order by x.created_at desc
    limit 1
  ) ic on true
  left join lateral (
    select e.id,e.occurred_at,e.decision,e.event_type
    from public.security_events e
    where e.workspace_id=v_workspace_id
      and e.agent_id=v_agent.id
      and e.event_type in ('gateway-authorization','gateway-tool-request')
    order by e.occurred_at desc
    limit 1
  ) se on true;
end;
$$;

revoke all on function public.integration_connection_status(text) from public;
revoke all on function public.integration_connection_status(text) from anon;
grant execute on function public.integration_connection_status(text) to authenticated;
