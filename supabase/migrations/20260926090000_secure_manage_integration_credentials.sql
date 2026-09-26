create or replace function public.list_integration_credentials()
returns table (
  id uuid,
  agent_id uuid,
  agent_external_id text,
  agent_name text,
  label text,
  secret_prefix text,
  status text,
  created_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz
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
  where wm.user_id = v_user_id
  order by wm.workspace_id
  limit 1;

  if v_workspace_id is null then raise exception 'workspace_required'; end if;

  return query
  select c.id,c.agent_id,a.external_id,a.name,c.label,c.secret_prefix,c.status,c.created_at,c.last_used_at,c.revoked_at
  from public.integration_credentials c
  join public.agents a on a.id = c.agent_id
  where c.workspace_id = v_workspace_id
  order by c.created_at desc;
end;
$$;

revoke all on function public.list_integration_credentials() from public;
revoke all on function public.list_integration_credentials() from anon;
grant execute on function public.list_integration_credentials() to authenticated;

create or replace function public.revoke_integration_credential(p_credential_id uuid)
returns table (id uuid,status text,revoked_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_role text;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;

  select wm.workspace_id,wm.role into v_workspace_id,v_role
  from public.workspace_members wm
  where wm.user_id = v_user_id
  order by wm.workspace_id
  limit 1;

  if v_workspace_id is null then raise exception 'workspace_required'; end if;
  if v_role not in ('owner','admin') then raise exception 'insufficient_role'; end if;

  return query
  update public.integration_credentials c
  set status='revoked',revoked_at=now()
  where c.id=p_credential_id and c.workspace_id=v_workspace_id and c.status='active'
  returning c.id,c.status,c.revoked_at;

  if not found then raise exception 'credential_not_found'; end if;
end;
$$;

revoke all on function public.revoke_integration_credential(uuid) from public;
revoke all on function public.revoke_integration_credential(uuid) from anon;
grant execute on function public.revoke_integration_credential(uuid) to authenticated;

create or replace function public.rotate_integration_credential(
  p_credential_id uuid,
  p_secret_hash text,
  p_secret_prefix text
)
returns table (
  id uuid,
  agent_id uuid,
  agent_external_id text,
  agent_name text,
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
  v_old public.integration_credentials%rowtype;
  v_new public.integration_credentials%rowtype;
  v_agent_external_id text;
  v_agent_name text;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;

  select wm.workspace_id,wm.role into v_workspace_id,v_role
  from public.workspace_members wm
  where wm.user_id = v_user_id
  order by wm.workspace_id
  limit 1;

  if v_workspace_id is null then raise exception 'workspace_required'; end if;
  if v_role not in ('owner','admin') then raise exception 'insufficient_role'; end if;

  select c.* into v_old
  from public.integration_credentials c
  where c.id=p_credential_id and c.workspace_id=v_workspace_id and c.status='active'
  for update;

  if v_old.id is null then raise exception 'credential_not_found'; end if;

  insert into public.integration_credentials (
    workspace_id,agent_id,label,secret_hash,secret_prefix,status,created_by,rotated_from
  )
  values (
    v_workspace_id,v_old.agent_id,v_old.label,p_secret_hash,p_secret_prefix,'active',v_user_id,v_old.id
  )
  returning * into v_new;

  update public.integration_credentials c
  set status='revoked',revoked_at=now()
  where c.id=v_old.id;

  select a.external_id,a.name into v_agent_external_id,v_agent_name
  from public.agents a
  where a.id=v_new.agent_id;

  return query
  select v_new.id,v_new.agent_id,v_agent_external_id,v_agent_name,v_new.label,v_new.secret_prefix,v_new.status,v_new.created_at;
end;
$$;

revoke all on function public.rotate_integration_credential(uuid,text,text) from public;
revoke all on function public.rotate_integration_credential(uuid,text,text) from anon;
grant execute on function public.rotate_integration_credential(uuid,text,text) to authenticated;
