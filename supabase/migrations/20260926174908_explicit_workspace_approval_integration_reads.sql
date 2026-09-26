create or replace function public.list_approval_requests(p_workspace_id uuid)
returns table (
  id uuid,
  event_type text,
  action text,
  decision text,
  occurred_at timestamptz,
  sequence_no bigint,
  agent_id uuid,
  payload jsonb,
  agent_external_id text,
  agent_name text,
  human_decision text,
  human_reason text,
  human_decided_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id=p_workspace_id and wm.user_id=v_user_id
  ) then raise exception 'workspace_access_denied'; end if;

  return query
  select
    e.id,e.event_type,e.action,e.decision::text,e.occurred_at,e.sequence_no,
    e.agent_id,e.payload,a.external_id,a.name,
    d.decision,d.reason,d.decided_at
  from public.security_events e
  left join public.agents a on a.id=e.agent_id
  left join public.approval_decisions d
    on d.workspace_id=e.workspace_id and d.security_event_id=e.id
  where e.workspace_id=p_workspace_id
    and e.decision='require_approval'
  order by e.sequence_no desc
  limit 100;
end;
$$;

revoke execute on function public.list_approval_requests() from authenticated, anon, public;
revoke all on function public.list_approval_requests(uuid) from public, anon;
grant execute on function public.list_approval_requests(uuid) to authenticated;

create or replace function public.integration_connection_status(
  p_workspace_id uuid,
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
set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_agent public.agents%rowtype;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;

  if not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id=p_workspace_id and wm.user_id=v_uid
  ) then raise exception 'workspace_access_denied'; end if;

  select a.* into v_agent
  from public.agents a
  where a.workspace_id=p_workspace_id
    and a.external_id=p_agent_external_id
  limit 1;

  if v_agent.id is null then raise exception 'unknown_agent'; end if;

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
    where x.workspace_id=p_workspace_id
      and x.agent_id=v_agent.id
      and x.status='active'
    order by x.created_at desc
    limit 1
  ) ic on true
  left join lateral (
    select e.id,e.occurred_at,e.decision,e.event_type
    from public.security_events e
    where e.workspace_id=p_workspace_id
      and e.agent_id=v_agent.id
      and e.event_type in ('gateway-authorization','gateway-tool-request')
    order by e.occurred_at desc
    limit 1
  ) se on true;
end;
$$;

revoke execute on function public.integration_connection_status(text) from authenticated, anon, public;
revoke all on function public.integration_connection_status(uuid,text) from public, anon;
grant execute on function public.integration_connection_status(uuid,text) to authenticated;
