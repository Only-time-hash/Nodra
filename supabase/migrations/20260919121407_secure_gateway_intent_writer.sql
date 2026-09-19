create or replace function public.record_gateway_intent(
  p_workspace_id uuid,
  p_incident_id uuid,
  p_agent_id uuid,
  p_request_id text,
  p_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  ) then
    raise exception 'not_authorized';
  end if;

  if p_incident_id is not null and not exists (
    select 1 from public.incidents
    where id = p_incident_id and workspace_id = p_workspace_id
  ) then
    raise exception 'incident_workspace_mismatch';
  end if;

  if p_agent_id is not null and not exists (
    select 1 from public.agents
    where id = p_agent_id and workspace_id = p_workspace_id
  ) then
    raise exception 'agent_workspace_mismatch';
  end if;

  insert into public.gateway_outbox(
    workspace_id, incident_id, agent_id, request_id, phase, payload
  ) values (
    p_workspace_id, p_incident_id, p_agent_id, p_request_id, 'intent',
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict(workspace_id, request_id, phase)
  do update set payload = excluded.payload
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function public.record_gateway_intent(uuid,uuid,uuid,text,jsonb) from public, anon;
grant execute on function public.record_gateway_intent(uuid,uuid,uuid,text,jsonb) to authenticated, service_role;

