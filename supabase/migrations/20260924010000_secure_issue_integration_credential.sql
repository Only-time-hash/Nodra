create or replace function public.issue_integration_credential(
  p_agent_external_id text,
  p_label text,
  p_secret_hash text,
  p_secret_prefix text
)
returns table (
  id uuid,
  label text,
  secret_prefix text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_role text;
  v_agent_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  select wm.workspace_id, wm.role
    into v_workspace_id, v_role
  from public.workspace_members wm
  where wm.user_id = v_user_id
  order by wm.workspace_id
  limit 1;

  if v_workspace_id is null then
    raise exception 'workspace_required';
  end if;

  if v_role not in ('owner','admin') then
    raise exception 'insufficient_role';
  end if;

  select a.id
    into v_agent_id
  from public.agents a
  where a.workspace_id = v_workspace_id
    and a.external_id = p_agent_external_id
  limit 1;

  if v_agent_id is null then
    raise exception 'unknown_agent';
  end if;

  return query
  insert into public.integration_credentials (
    workspace_id,
    agent_id,
    label,
    secret_hash,
    secret_prefix,
    created_by
  )
  values (
    v_workspace_id,
    v_agent_id,
    left(coalesce(nullif(trim(p_label),''),'Default integration'),80),
    p_secret_hash,
    p_secret_prefix,
    v_user_id
  )
  returning
    integration_credentials.id,
    integration_credentials.label,
    integration_credentials.secret_prefix,
    integration_credentials.status,
    integration_credentials.created_at;
end;
$$;

revoke all on function public.issue_integration_credential(text,text,text,text) from public;
revoke all on function public.issue_integration_credential(text,text,text,text) from anon;
grant execute on function public.issue_integration_credential(text,text,text,text) to authenticated;
