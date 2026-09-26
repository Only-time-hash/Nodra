create or replace function public.list_workspace_members(p_workspace_id uuid)
returns table (
  user_id uuid,
  email text,
  display_name text,
  role text,
  joined_at timestamptz
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
    wm.user_id,
    u.email::text,
    coalesce(
      nullif(u.raw_user_meta_data->>'full_name',''),
      nullif(u.raw_user_meta_data->>'name',''),
      nullif(u.raw_user_meta_data->>'user_name',''),
      split_part(coalesce(u.email,''),'@',1)
    )::text,
    wm.role::text,
    wm.created_at
  from public.workspace_members wm
  join auth.users u on u.id=wm.user_id
  where wm.workspace_id=p_workspace_id
  order by
    case wm.role when 'owner' then 0 when 'admin' then 1 when 'analyst' then 2 else 3 end,
    wm.created_at;
end;
$$;

revoke execute on function public.list_workspace_members() from authenticated, anon, public;
revoke all on function public.list_workspace_members(uuid) from public, anon;
grant execute on function public.list_workspace_members(uuid) to authenticated;

create or replace function public.set_notification_destination(
  p_workspace_id uuid,
  p_kind text,
  p_label text,
  p_endpoint_url text,
  p_event_types text[] default array['incident','denial','recovery']::text[]
)
returns table(id uuid, kind text, label text, enabled boolean, event_types text[])
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_existing public.notification_destinations%rowtype;
  v_secret uuid;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_kind not in ('webhook','slack','teams','pagerduty') then raise exception 'invalid_notification_kind'; end if;
  if p_endpoint_url !~ '^https://[^[:space:]]+$' then raise exception 'https_endpoint_required'; end if;
  if nullif(btrim(p_label),'') is null then raise exception 'label_required'; end if;

  select wm.role into v_role
  from public.workspace_members wm
  where wm.workspace_id=p_workspace_id and wm.user_id=v_user
  limit 1;

  if v_role is null then raise exception 'workspace_access_denied'; end if;
  if v_role not in ('owner','admin') then raise exception 'insufficient_role'; end if;

  select * into v_existing
  from public.notification_destinations nd
  where nd.workspace_id=p_workspace_id
    and nd.kind=p_kind
    and nd.label=btrim(p_label)
  limit 1;

  if v_existing.id is null then
    select vault.create_secret(
      p_endpoint_url,
      'nodra-notification-' || p_workspace_id::text || '-' || gen_random_uuid()::text,
      'Nodra external notification endpoint',
      null
    ) into v_secret;

    insert into public.notification_destinations(
      workspace_id, kind, label, vault_secret_id, enabled, event_types, created_by
    ) values (
      p_workspace_id, p_kind, btrim(p_label), v_secret, true, coalesce(p_event_types,'{}'::text[]), v_user
    )
    returning notification_destinations.id into v_existing.id;
  else
    perform vault.update_secret(
      v_existing.vault_secret_id,
      p_endpoint_url,
      null,
      'Nodra external notification endpoint',
      null
    );

    update public.notification_destinations nd
    set enabled=true,
        event_types=coalesce(p_event_types,'{}'::text[]),
        updated_at=clock_timestamp()
    where nd.id=v_existing.id;
  end if;

  update public.workspace_settings ws
  set external_notifications_enabled=true,
      updated_at=clock_timestamp()
  where ws.workspace_id=p_workspace_id;

  return query
  select nd.id, nd.kind, nd.label, nd.enabled, nd.event_types
  from public.notification_destinations nd
  where nd.id=v_existing.id;
end;
$$;

revoke execute on function public.set_notification_destination(text,text,text,text[]) from authenticated, anon, public;
revoke all on function public.set_notification_destination(uuid,text,text,text,text[]) from public, anon;
grant execute on function public.set_notification_destination(uuid,text,text,text,text[]) to authenticated;

create or replace function public.delete_notification_destination(p_workspace_id uuid, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_secret uuid;
begin
  if v_user is null then raise exception 'authentication_required'; end if;

  select wm.role into v_role
  from public.workspace_members wm
  where wm.workspace_id=p_workspace_id and wm.user_id=v_user
  limit 1;

  if v_role is null then raise exception 'workspace_access_denied'; end if;
  if v_role not in ('owner','admin') then raise exception 'insufficient_role'; end if;

  select nd.vault_secret_id into v_secret
  from public.notification_destinations nd
  where nd.id=p_id and nd.workspace_id=p_workspace_id;

  if v_secret is null then return false; end if;

  delete from public.notification_destinations
  where id=p_id and workspace_id=p_workspace_id;

  delete from vault.secrets where id=v_secret;

  if not exists (
    select 1 from public.notification_destinations nd
    where nd.workspace_id=p_workspace_id and nd.enabled
  ) then
    update public.workspace_settings
    set external_notifications_enabled=false, updated_at=clock_timestamp()
    where workspace_id=p_workspace_id;
  end if;

  return true;
end;
$$;

revoke execute on function public.delete_notification_destination(uuid) from authenticated, anon, public;
revoke all on function public.delete_notification_destination(uuid,uuid) from public, anon;
grant execute on function public.delete_notification_destination(uuid,uuid) to authenticated;

create or replace function public.list_integration_credentials(p_workspace_id uuid)
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
  select c.id,c.agent_id,a.external_id,a.name,c.label,c.secret_prefix,c.status,c.created_at,c.last_used_at,c.revoked_at
  from public.integration_credentials c
  join public.agents a on a.id=c.agent_id
  where c.workspace_id=p_workspace_id
  order by c.created_at desc;
end;
$$;

revoke execute on function public.list_integration_credentials() from authenticated, anon, public;
revoke all on function public.list_integration_credentials(uuid) from public, anon;
grant execute on function public.list_integration_credentials(uuid) to authenticated;

create or replace function public.issue_integration_credential(
  p_workspace_id uuid,
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
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_agent_id uuid;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;

  select wm.role into v_role
  from public.workspace_members wm
  where wm.workspace_id=p_workspace_id and wm.user_id=v_user_id
  limit 1;

  if v_role is null then raise exception 'workspace_access_denied'; end if;
  if v_role not in ('owner','admin') then raise exception 'insufficient_role'; end if;

  select a.id into v_agent_id
  from public.agents a
  where a.workspace_id=p_workspace_id and a.external_id=p_agent_external_id
  limit 1;

  if v_agent_id is null then raise exception 'unknown_agent'; end if;

  return query
  insert into public.integration_credentials (
    workspace_id,agent_id,label,secret_hash,secret_prefix,created_by
  ) values (
    p_workspace_id,v_agent_id,left(coalesce(nullif(trim(p_label),''),'Default integration'),80),
    p_secret_hash,p_secret_prefix,v_user_id
  )
  returning
    integration_credentials.id,
    integration_credentials.label,
    integration_credentials.secret_prefix,
    integration_credentials.status,
    integration_credentials.created_at;
end;
$$;

revoke execute on function public.issue_integration_credential(text,text,text,text) from authenticated, anon, public;
revoke all on function public.issue_integration_credential(uuid,text,text,text,text) from public, anon;
grant execute on function public.issue_integration_credential(uuid,text,text,text,text) to authenticated;

create or replace function public.revoke_integration_credential(p_workspace_id uuid, p_credential_id uuid)
returns table (id uuid,status text,revoked_at timestamptz)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;

  select wm.role into v_role
  from public.workspace_members wm
  where wm.workspace_id=p_workspace_id and wm.user_id=v_user_id
  limit 1;

  if v_role is null then raise exception 'workspace_access_denied'; end if;
  if v_role not in ('owner','admin') then raise exception 'insufficient_role'; end if;

  return query
  update public.integration_credentials c
  set status='revoked',revoked_at=now()
  where c.id=p_credential_id and c.workspace_id=p_workspace_id and c.status='active'
  returning c.id,c.status,c.revoked_at;

  if not found then raise exception 'credential_not_found'; end if;
end;
$$;

revoke execute on function public.revoke_integration_credential(uuid) from authenticated, anon, public;
revoke all on function public.revoke_integration_credential(uuid,uuid) from public, anon;
grant execute on function public.revoke_integration_credential(uuid,uuid) to authenticated;

create or replace function public.rotate_integration_credential(
  p_workspace_id uuid,
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
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_old public.integration_credentials%rowtype;
  v_new public.integration_credentials%rowtype;
  v_agent_external_id text;
  v_agent_name text;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;

  select wm.role into v_role
  from public.workspace_members wm
  where wm.workspace_id=p_workspace_id and wm.user_id=v_user_id
  limit 1;

  if v_role is null then raise exception 'workspace_access_denied'; end if;
  if v_role not in ('owner','admin') then raise exception 'insufficient_role'; end if;

  select c.* into v_old
  from public.integration_credentials c
  where c.id=p_credential_id and c.workspace_id=p_workspace_id and c.status='active'
  for update;

  if v_old.id is null then raise exception 'credential_not_found'; end if;

  insert into public.integration_credentials (
    workspace_id,agent_id,label,secret_hash,secret_prefix,status,created_by,rotated_from
  ) values (
    p_workspace_id,v_old.agent_id,v_old.label,p_secret_hash,p_secret_prefix,'active',v_user_id,v_old.id
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

revoke execute on function public.rotate_integration_credential(uuid,text,text) from authenticated, anon, public;
revoke all on function public.rotate_integration_credential(uuid,uuid,text,text) from public, anon;
grant execute on function public.rotate_integration_credential(uuid,uuid,text,text) to authenticated;
