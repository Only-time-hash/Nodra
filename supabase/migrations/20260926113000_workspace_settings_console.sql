create table if not exists public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  description text not null default '',
  agent_health_threshold_minutes integer not null default 5 check (agent_health_threshold_minutes between 1 and 1440),
  event_retention_days integer not null default 90 check (event_retention_days between 1 and 3650),
  default_timezone text not null default 'UTC',
  date_format text not null default 'YYYY-MM-DD',
  theme text not null default 'dark' check (theme in ('dark','system')),
  require_mfa boolean not null default false,
  ip_restrictions boolean not null default false,
  session_timeout_minutes integer not null default 30 check (session_timeout_minutes between 5 and 1440),
  require_strong_passwords boolean not null default true,
  allow_api_access boolean not null default true,
  ai_config jsonb not null default '{}'::jsonb,
  agent_controls jsonb not null default '{}'::jsonb,
  approval_policies jsonb not null default '{}'::jsonb,
  notifications jsonb not null default '{"incidentAlerts":true,"denialAlerts":true,"recoveryAlerts":true}'::jsonb,
  evidence_config jsonb not null default '{"exportFormat":"json"}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.workspace_settings enable row level security;

drop policy if exists workspace_settings_read on public.workspace_settings;
create policy workspace_settings_read on public.workspace_settings
for select to authenticated
using (
  exists (
    select 1 from public.workspace_members m
    where m.workspace_id=workspace_settings.workspace_id
      and m.user_id=(select auth.uid())
  )
);

drop policy if exists workspace_settings_write on public.workspace_settings;
create policy workspace_settings_write on public.workspace_settings
for all to authenticated
using (
  exists (
    select 1 from public.workspace_members m
    where m.workspace_id=workspace_settings.workspace_id
      and m.user_id=(select auth.uid())
      and m.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1 from public.workspace_members m
    where m.workspace_id=workspace_settings.workspace_id
      and m.user_id=(select auth.uid())
      and m.role in ('owner','admin')
  )
);

create or replace function public.list_workspace_members()
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
  where wm.workspace_id=v_workspace_id
  order by
    case wm.role when 'owner' then 0 when 'admin' then 1 when 'analyst' then 2 else 3 end,
    wm.created_at;
end;
$$;

revoke all on function public.list_workspace_members() from public,anon;
grant execute on function public.list_workspace_members() to authenticated;

create or replace function public.integration_api_access_allowed(p_secret_hash text)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_workspace_id uuid;
  v_allowed boolean;
begin
  select ic.workspace_id into v_workspace_id
  from public.integration_credentials ic
  where ic.secret_hash=p_secret_hash and ic.status='active'
  limit 1;

  if v_workspace_id is null then return false; end if;

  select coalesce(ws.allow_api_access,true) into v_allowed
  from public.workspace_settings ws
  where ws.workspace_id=v_workspace_id;

  return coalesce(v_allowed,true);
end;
$$;

revoke all on function public.integration_api_access_allowed(text) from public;
grant execute on function public.integration_api_access_allowed(text) to anon,authenticated;
