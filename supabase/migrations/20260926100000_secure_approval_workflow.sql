create or replace function public.list_approval_requests()
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
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select wm.workspace_id into v_workspace_id
  from public.workspace_members wm
  where wm.user_id=v_user_id
  order by wm.workspace_id
  limit 1;
  if v_workspace_id is null then raise exception 'workspace_required'; end if;

  return query
  select
    e.id,e.event_type,e.action,e.decision::text,e.occurred_at,e.sequence_no,
    e.agent_id,e.payload,a.external_id,a.name,
    d.decision,d.reason,d.decided_at
  from public.security_events e
  left join public.agents a on a.id=e.agent_id
  left join public.approval_decisions d
    on d.workspace_id=e.workspace_id and d.security_event_id=e.id
  where e.workspace_id=v_workspace_id
    and e.decision='require_approval'
  order by e.sequence_no desc
  limit 100;
end;
$$;

revoke all on function public.list_approval_requests() from public;
revoke all on function public.list_approval_requests() from anon;
grant execute on function public.list_approval_requests() to authenticated;

create or replace function public.decide_approval(
  p_event_id uuid,
  p_decision text,
  p_reason text,
  p_execution_token_hash text default null,
  p_execution_token_expires_at timestamptz default null
)
returns table (
  id uuid,
  decision text,
  reason text,
  decided_at timestamptz,
  execution_token_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_role text;
  v_event_id uuid;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;

  select wm.workspace_id,wm.role into v_workspace_id,v_role
  from public.workspace_members wm
  where wm.user_id=v_user_id
  order by wm.workspace_id
  limit 1;

  if v_workspace_id is null then raise exception 'workspace_required'; end if;
  if v_role not in ('owner','admin','analyst') then raise exception 'insufficient_role'; end if;
  if p_decision not in ('approved','denied') then raise exception 'invalid_decision'; end if;
  if length(trim(coalesce(p_reason,''))) < 3 or length(p_reason) > 500 then raise exception 'invalid_reason'; end if;
  if p_decision='approved' and (p_execution_token_hash is null or p_execution_token_expires_at is null) then
    raise exception 'approval_token_required';
  end if;

  select e.id into v_event_id
  from public.security_events e
  where e.id=p_event_id
    and e.workspace_id=v_workspace_id
    and e.decision='require_approval'
  limit 1;

  if v_event_id is null then raise exception 'approval_event_not_found'; end if;

  return query
  insert into public.approval_decisions(
    workspace_id,security_event_id,decided_by,decision,reason,
    execution_token_hash,execution_token_expires_at
  )
  values(
    v_workspace_id,v_event_id,v_user_id,p_decision,trim(p_reason),
    case when p_decision='approved' then p_execution_token_hash else null end,
    case when p_decision='approved' then p_execution_token_expires_at else null end
  )
  returning
    approval_decisions.id,
    approval_decisions.decision,
    approval_decisions.reason,
    approval_decisions.decided_at,
    approval_decisions.execution_token_expires_at;
end;
$$;

revoke all on function public.decide_approval(uuid,text,text,text,timestamptz) from public;
revoke all on function public.decide_approval(uuid,text,text,text,timestamptz) from anon;
grant execute on function public.decide_approval(uuid,text,text,text,timestamptz) to authenticated;
