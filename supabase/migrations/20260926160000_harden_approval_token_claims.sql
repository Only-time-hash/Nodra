create or replace function public.claim_integration_approval_token(
  p_secret_hash text,
  p_external_agent_id text,
  p_authorization_event_id uuid,
  p_resource_external_id text,
  p_action text,
  p_execution_token_hash text,
  p_execution_token_expires_at timestamptz
)
returns table(status text, expires_at timestamptz)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_credential public.integration_credentials%rowtype;
  v_agent public.agents%rowtype;
  v_event public.security_events%rowtype;
  v_decision public.approval_decisions%rowtype;
  v_payload jsonb;
  v_now timestamptz:=clock_timestamp();
begin
  if p_execution_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_approval_token_hash';
  end if;

  if p_execution_token_expires_at<=v_now
     or p_execution_token_expires_at>v_now+interval '5 minutes 30 seconds' then
    raise exception 'invalid_approval_token_expiry';
  end if;

  select ic.* into v_credential
  from public.integration_credentials ic
  where ic.secret_hash=p_secret_hash and ic.status='active'
  limit 1;
  if v_credential.id is null then raise exception 'invalid_credential'; end if;

  select a.* into v_agent
  from public.agents a
  where a.id=v_credential.agent_id
    and a.workspace_id=v_credential.workspace_id
    and a.external_id=p_external_agent_id
  limit 1;
  if v_agent.id is null then raise exception 'invalid_credential'; end if;

  select e.* into v_event
  from public.security_events e
  where e.id=p_authorization_event_id
    and e.workspace_id=v_credential.workspace_id
    and e.agent_id=v_agent.id
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

  select d.* into v_decision
  from public.approval_decisions d
  where d.workspace_id=v_credential.workspace_id
    and d.security_event_id=v_event.id
  for update;

  if v_decision.id is null then raise exception 'approval_pending'; end if;
  if v_decision.decision='denied' then raise exception 'approval_denied'; end if;
  if v_decision.consumed_at is not null then raise exception 'approval_token_consumed'; end if;

  if v_decision.execution_token_hash is null then
    update public.approval_decisions d
    set execution_token_hash=p_execution_token_hash,
        execution_token_expires_at=p_execution_token_expires_at,
        token_claimed_at=v_now
    where d.id=v_decision.id;
    return query select 'approved'::text,p_execution_token_expires_at;
    return;
  end if;

  if v_decision.execution_token_hash<>p_execution_token_hash then
    raise exception 'approval_token_already_claimed';
  end if;

  if v_decision.execution_token_expires_at is null
     or v_decision.execution_token_expires_at<=v_now then
    raise exception 'approval_token_expired';
  end if;

  return query select 'approved'::text,v_decision.execution_token_expires_at;
end;
$$;

revoke all on function public.claim_integration_approval_token(text,text,uuid,text,text,text,timestamptz) from public;
grant execute on function public.claim_integration_approval_token(text,text,uuid,text,text,text,timestamptz) to anon,authenticated;
