create or replace function public.integration_high_impact_review_enabled(
  p_secret_hash text,
  p_action text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_workspace_id uuid;
  v_enabled boolean := false;
  v_action text := lower(coalesce(p_action,''));
begin
  select ic.workspace_id into v_workspace_id
  from public.integration_credentials ic
  where ic.secret_hash=p_secret_hash and ic.status='active'
  limit 1;

  if v_workspace_id is null then return false; end if;

  select coalesce((ws.approval_policies->>'highImpactReview')::boolean,false)
    into v_enabled
  from public.workspace_settings ws
  where ws.workspace_id=v_workspace_id;

  if not coalesce(v_enabled,false) then return false; end if;

  return
    v_action like 'payments.%'
    or v_action like 'bank.%'
    or v_action like 'credentials.%'
    or v_action in (
      'data.export',
      'agent.delete',
      'agent.pause',
      'agent.quarantine',
      'system.restart',
      'system.deploy',
      'system.delete',
      'account.delete',
      'workspace.delete'
    );
end;
$$;

revoke all on function public.integration_high_impact_review_enabled(text,text) from public;
grant execute on function public.integration_high_impact_review_enabled(text,text) to anon,authenticated;

create or replace function public.append_high_impact_review_override(
  p_secret_hash text,
  p_original_event_id uuid,
  p_action text,
  p_resource_external_id text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_credential public.integration_credentials%rowtype;
  v_event public.security_events%rowtype;
  v_event_id uuid;
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

  v_event_id:=public.append_integration_security_event(
    v_credential.workspace_id,
    v_event.incident_id,
    v_credential.agent_id,
    'high-impact-review',
    p_action,
    v_event.resource_id,
    'require_approval',
    v_event.id,
    pg_catalog.jsonb_build_object(
      'resourceId',p_resource_external_id,
      'reason','workspace_high_impact_review',
      'credentialId',v_credential.id,
      'originalAuthorizationEventId',v_event.id
    ),
    clock_timestamp()
  );

  return v_event_id;
end;
$$;

revoke all on function public.append_high_impact_review_override(text,uuid,text,text) from public;
grant execute on function public.append_high_impact_review_override(text,uuid,text,text) to anon,authenticated;
