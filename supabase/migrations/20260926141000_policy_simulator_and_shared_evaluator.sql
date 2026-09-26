create or replace function public.select_runtime_policy(
  p_workspace_id uuid,
  p_agent_id uuid,
  p_resource_external_id text,
  p_action text,
  p_context jsonb default '{}'::jsonb
)
returns table(policy_id uuid,effect text,reason text,priority integer)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_policy public.policies%rowtype;
  v_now timestamptz:=clock_timestamp();
  v_amount numeric;
  v_environment text;
  v_hour integer:=extract(hour from v_now at time zone 'UTC')::integer;
  v_dow integer:=extract(dow from v_now at time zone 'UTC')::integer;
  v_metadata jsonb:=case
    when jsonb_typeof(coalesce(p_context,'{}'::jsonb)->'metadata')='object'
    then coalesce(p_context,'{}'::jsonb)->'metadata'
    else '{}'::jsonb
  end;
begin
  if jsonb_typeof(coalesce(p_context,'{}'::jsonb)->'amount')='number' then
    v_amount:=(p_context->>'amount')::numeric;
  end if;
  v_environment:=nullif(p_context->>'environment','');

  select p.* into v_policy
  from public.policies p
  left join public.resources r
    on r.id=p.resource_id and r.workspace_id=p.workspace_id
  where p.workspace_id=p_workspace_id
    and p.enabled=true
    and (p.agent_id is null or p.agent_id=p_agent_id)
    and (p.resource_id is null or r.external_id=p_resource_external_id)
    and (
      p.action='*'
      or p.action=p_action
      or (right(p.action,1)='*' and p_action like left(p.action,length(p.action)-1)||'%')
    )
    and (p.starts_at is null or p.starts_at<=v_now)
    and (p.expires_at is null or p.expires_at>v_now)
    and (
      not (p.constraints ? 'amountGreaterThan')
      or (
        jsonb_typeof(p.constraints->'amountGreaterThan')='number'
        and v_amount is not null
        and v_amount>(p.constraints->>'amountGreaterThan')::numeric
      )
    )
    and (
      not (p.constraints ? 'amountGreaterThanOrEqual')
      or (
        jsonb_typeof(p.constraints->'amountGreaterThanOrEqual')='number'
        and v_amount is not null
        and v_amount>=(p.constraints->>'amountGreaterThanOrEqual')::numeric
      )
    )
    and (
      not (p.constraints ? 'amountLessThan')
      or (
        jsonb_typeof(p.constraints->'amountLessThan')='number'
        and v_amount is not null
        and v_amount<(p.constraints->>'amountLessThan')::numeric
      )
    )
    and (
      not (p.constraints ? 'amountLessThanOrEqual')
      or (
        jsonb_typeof(p.constraints->'amountLessThanOrEqual')='number'
        and v_amount is not null
        and v_amount<=(p.constraints->>'amountLessThanOrEqual')::numeric
      )
    )
    and (
      not (p.constraints ? 'environmentIn')
      or (
        jsonb_typeof(p.constraints->'environmentIn')='array'
        and v_environment is not null
        and (p.constraints->'environmentIn') ? v_environment
      )
    )
    and (
      not (p.constraints ? 'dayOfWeekIn')
      or (
        jsonb_typeof(p.constraints->'dayOfWeekIn')='array'
        and exists(
          select 1
          from jsonb_array_elements_text(p.constraints->'dayOfWeekIn') d(value)
          where d.value=v_dow::text
        )
      )
    )
    and (
      not (p.constraints ? 'hourUtcFrom')
      or (
        jsonb_typeof(p.constraints->'hourUtcFrom')='number'
        and (
          not (p.constraints ? 'hourUtcUntil')
          or jsonb_typeof(p.constraints->'hourUtcUntil')='number'
        )
        and (
          case
            when coalesce((p.constraints->>'hourUtcUntil')::integer,24)
                 >= (p.constraints->>'hourUtcFrom')::integer
            then v_hour >= (p.constraints->>'hourUtcFrom')::integer
              and v_hour < coalesce((p.constraints->>'hourUtcUntil')::integer,24)
            else v_hour >= (p.constraints->>'hourUtcFrom')::integer
              or v_hour < (p.constraints->>'hourUtcUntil')::integer
          end
        )
      )
    )
    and (
      not (p.constraints ? 'metadataEquals')
      or (
        jsonb_typeof(p.constraints->'metadataEquals')='object'
        and v_metadata @> (p.constraints->'metadataEquals')
      )
    )
  order by
    case p.effect::text
      when 'deny' then 0
      when 'require_approval' then 1
      else 2
    end,
    p.priority desc,
    p.created_at asc
  limit 1;

  if v_policy.id is null then return; end if;

  return query select
    v_policy.id,
    v_policy.effect::text,
    case v_policy.effect::text
      when 'deny' then 'explicit_policy_deny'
      when 'require_approval' then 'explicit_policy_requires_approval'
      else 'explicit_policy_allow'
    end,
    v_policy.priority;
end;
$$;

revoke all on function public.select_runtime_policy(uuid,uuid,text,text,jsonb) from public,anon,authenticated;

create or replace function public.apply_integration_policy_override(
  p_secret_hash text,
  p_original_event_id uuid,
  p_resource_external_id text,
  p_action text,
  p_context jsonb default '{}'::jsonb
)
returns table(
  decision text,
  reason text,
  policy_id uuid,
  authorization_event_id uuid
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_credential public.integration_credentials%rowtype;
  v_event public.security_events%rowtype;
  v_match record;
  v_override_event uuid;
  v_now timestamptz:=clock_timestamp();
begin
  select ic.* into v_credential
  from public.integration_credentials ic
  where ic.secret_hash=p_secret_hash and ic.status='active'
  limit 1;
  if v_credential.id is null then raise exception 'invalid_credential'; end if;

  select e.* into v_event
  from public.security_events e
  where e.id=p_original_event_id
    and e.workspace_id=v_credential.workspace_id
    and e.agent_id=v_credential.agent_id
    and e.action=p_action
    and e.decision='allow'
  limit 1;
  if v_event.id is null then raise exception 'authorization_event_mismatch'; end if;

  select * into v_match
  from public.select_runtime_policy(
    v_credential.workspace_id,
    v_credential.agent_id,
    p_resource_external_id,
    p_action,
    coalesce(p_context,'{}'::jsonb)
  )
  limit 1;

  if v_match.policy_id is null or v_match.effect='allow' then return; end if;

  v_override_event:=public.append_integration_security_event(
    v_credential.workspace_id,
    v_event.incident_id,
    v_credential.agent_id,
    'policy-override',
    p_action,
    v_event.resource_id,
    v_match.effect,
    v_event.id,
    pg_catalog.jsonb_build_object(
      'resourceId',p_resource_external_id,
      'reason',v_match.reason,
      'policyId',v_match.policy_id,
      'priority',v_match.priority,
      'context',coalesce(p_context,'{}'::jsonb),
      'originalAuthorizationEventId',v_event.id
    ),
    v_now
  );

  return query select
    v_match.effect,
    v_match.reason,
    v_match.policy_id,
    v_override_event;
end;
$$;

revoke all on function public.apply_integration_policy_override(text,uuid,text,text,jsonb) from public;
grant execute on function public.apply_integration_policy_override(text,uuid,text,text,jsonb) to anon,authenticated;

create or replace function public.simulate_workspace_policy(
  p_agent_id uuid,
  p_resource_external_id text,
  p_action text,
  p_context jsonb default '{}'::jsonb
)
returns table(
  decision text,
  reason text,
  matched_policy_id uuid,
  base_decision text
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_workspace_id uuid;
  v_agent public.agents%rowtype;
  v_allowed text[];
  v_base text;
  v_match record;
  v_high_impact boolean:=false;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;

  select wm.workspace_id into v_workspace_id
  from public.workspace_members wm
  where wm.user_id=v_user_id
  order by wm.workspace_id
  limit 1;

  if v_workspace_id is null then raise exception 'workspace_required'; end if;

  select a.* into v_agent
  from public.agents a
  where a.id=p_agent_id and a.workspace_id=v_workspace_id
  limit 1;
  if v_agent.id is null then raise exception 'agent_not_found'; end if;

  if jsonb_typeof(v_agent.authority_scope)='array' then
    select coalesce(array_agg(j.value),array[]::text[])
      into v_allowed
    from jsonb_array_elements_text(v_agent.authority_scope) j(value);
  elsif jsonb_typeof(v_agent.authority_scope)='object' then
    select coalesce(array_agg(j.key),array[]::text[])
      into v_allowed
    from jsonb_each(v_agent.authority_scope) j(key,value)
    where j.value='true'::jsonb;
  else
    v_allowed:=array[]::text[];
  end if;

  if v_agent.status::text<>'healthy' then
    return query select 'deny'::text,'agent_not_healthy'::text,null::uuid,'deny'::text;
    return;
  elsif '*'=any(v_allowed)
     or p_action=any(v_allowed)
     or p_resource_external_id=any(v_allowed)
     or (p_resource_external_id||':'||p_action)=any(v_allowed) then
    v_base:='allow';
  else
    v_base:='require_approval';
  end if;

  select * into v_match
  from public.select_runtime_policy(
    v_workspace_id,v_agent.id,p_resource_external_id,p_action,coalesce(p_context,'{}'::jsonb)
  )
  limit 1;

  if v_match.effect='deny' then
    return query select 'deny'::text,v_match.reason,v_match.policy_id,v_base;
    return;
  end if;

  if v_match.effect='require_approval' then
    return query select 'require_approval'::text,v_match.reason,v_match.policy_id,v_base;
    return;
  end if;

  if v_base='require_approval' then
    return query select 'require_approval'::text,'outside_explicit_authority'::text,v_match.policy_id,v_base;
    return;
  end if;

  select coalesce((ws.approval_policies->>'highImpactReview')::boolean,false)
    into v_high_impact
  from public.workspace_settings ws
  where ws.workspace_id=v_workspace_id;

  if coalesce(v_high_impact,false) and (
    lower(p_action) like 'payments.%'
    or lower(p_action) like 'bank.%'
    or lower(p_action) like 'credentials.%'
    or lower(p_action) in (
      'data.export','agent.delete','agent.pause','agent.quarantine',
      'system.restart','system.deploy','system.delete','account.delete','workspace.delete'
    )
  ) then
    return query select 'require_approval'::text,'workspace_high_impact_review'::text,v_match.policy_id,v_base;
    return;
  end if;

  return query select 'allow'::text,coalesce(v_match.reason,'authority_scope_allows'),v_match.policy_id,v_base;
end;
$$;

revoke all on function public.simulate_workspace_policy(uuid,text,text,jsonb) from public,anon;
grant execute on function public.simulate_workspace_policy(uuid,text,text,jsonb) to authenticated;
