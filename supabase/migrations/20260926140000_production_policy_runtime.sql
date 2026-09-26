alter table public.policies
  add column if not exists priority integer not null default 100,
  add column if not exists starts_at timestamptz,
  add column if not exists expires_at timestamptz;

create index if not exists policies_runtime_match_idx
  on public.policies(workspace_id,enabled,agent_id,resource_id,action,priority desc);

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
  v_policy public.policies%rowtype;
  v_resource_external text;
  v_effect text;
  v_reason text;
  v_override_event uuid;
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

  if jsonb_typeof(coalesce(p_context,'{}'::jsonb)->'amount')='number' then
    v_amount:=(p_context->>'amount')::numeric;
  end if;
  v_environment:=nullif(p_context->>'environment','');

  select p.* into v_policy
  from public.policies p
  left join public.resources r
    on r.id=p.resource_id and r.workspace_id=p.workspace_id
  where p.workspace_id=v_credential.workspace_id
    and p.enabled=true
    and (p.agent_id is null or p.agent_id=v_credential.agent_id)
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

  if v_policy.id is null or v_policy.effect::text='allow' then
    return;
  end if;

  v_effect:=v_policy.effect::text;
  v_reason:=case
    when v_effect='deny' then 'explicit_policy_deny'
    else 'explicit_policy_requires_approval'
  end;

  v_override_event:=public.append_integration_security_event(
    v_credential.workspace_id,
    v_event.incident_id,
    v_credential.agent_id,
    'policy-override',
    p_action,
    v_event.resource_id,
    v_effect,
    v_event.id,
    pg_catalog.jsonb_build_object(
      'resourceId',p_resource_external_id,
      'reason',v_reason,
      'policyId',v_policy.id,
      'priority',v_policy.priority,
      'context',coalesce(p_context,'{}'::jsonb),
      'originalAuthorizationEventId',v_event.id
    ),
    v_now
  );

  return query select
    v_effect,
    v_reason,
    v_policy.id,
    v_override_event;
end;
$$;

revoke all on function public.apply_integration_policy_override(text,uuid,text,text,jsonb) from public;
grant execute on function public.apply_integration_policy_override(text,uuid,text,text,jsonb) to anon,authenticated;
