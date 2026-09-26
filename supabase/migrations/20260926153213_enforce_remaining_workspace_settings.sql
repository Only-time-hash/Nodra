alter table public.workspace_settings
  add column if not exists ip_allowlist inet[] not null default '{}'::inet[],
  add column if not exists external_notifications_enabled boolean not null default false;

alter table public.security_events
  add column if not exists archived_at timestamptz;

create table if not exists public.security_event_archives (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_event_id uuid not null unique references public.security_events(id) on delete cascade,
  event_snapshot jsonb not null,
  archived_at timestamptz not null default clock_timestamp()
);

alter table public.security_event_archives enable row level security;

drop policy if exists security_event_archives_read on public.security_event_archives;
create policy security_event_archives_read
on public.security_event_archives
for select to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = security_event_archives.workspace_id
      and wm.user_id = (select auth.uid())
  )
);

create index if not exists security_event_archives_workspace_archived_idx
  on public.security_event_archives(workspace_id, archived_at desc);

create or replace function public.archive_expired_security_events()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_count integer := 0;
begin
  insert into public.security_event_archives(workspace_id, source_event_id, event_snapshot)
  select se.workspace_id, se.id, to_jsonb(se)
  from public.security_events se
  join public.workspace_settings ws on ws.workspace_id = se.workspace_id
  where se.archived_at is null
    and se.occurred_at < clock_timestamp() - make_interval(days => ws.event_retention_days)
  on conflict (source_event_id) do nothing;

  get diagnostics v_count = row_count;

  update public.security_events se
  set archived_at = clock_timestamp()
  from public.workspace_settings ws
  where ws.workspace_id = se.workspace_id
    and se.archived_at is null
    and se.occurred_at < clock_timestamp() - make_interval(days => ws.event_retention_days);

  return v_count;
end;
$$;

revoke all on function public.archive_expired_security_events() from public, anon, authenticated;

create schema if not exists extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table if not exists public.notification_destinations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('webhook','slack','teams','pagerduty')),
  label text not null,
  vault_secret_id uuid not null,
  enabled boolean not null default true,
  event_types text[] not null default array['incident','denial','recovery']::text[],
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(workspace_id, kind, label)
);

alter table public.notification_destinations enable row level security;

drop policy if exists notification_destinations_read on public.notification_destinations;
create policy notification_destinations_read
on public.notification_destinations
for select to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = notification_destinations.workspace_id
      and wm.user_id = (select auth.uid())
  )
);

create table if not exists public.notification_outbox (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  event_kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  delivered_at timestamptz,
  attempt_count integer not null default 0,
  last_error text
);

alter table public.notification_outbox enable row level security;
revoke all on table public.notification_outbox from anon, authenticated;

create index if not exists notification_outbox_pending_idx
  on public.notification_outbox(delivered_at, created_at)
  where delivered_at is null;

create or replace function public.set_notification_destination(
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
  v_workspace uuid;
  v_role text;
  v_existing public.notification_destinations%rowtype;
  v_secret uuid;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_kind not in ('webhook','slack','teams','pagerduty') then raise exception 'invalid_notification_kind'; end if;
  if p_endpoint_url !~ '^https://[^[:space:]]+$' then raise exception 'https_endpoint_required'; end if;
  if nullif(btrim(p_label),'') is null then raise exception 'label_required'; end if;

  select wm.workspace_id, wm.role into v_workspace, v_role
  from public.workspace_members wm
  where wm.user_id = v_user
  order by wm.workspace_id
  limit 1;

  if v_workspace is null then raise exception 'workspace_required'; end if;
  if v_role not in ('owner','admin') then raise exception 'insufficient_role'; end if;

  select * into v_existing
  from public.notification_destinations nd
  where nd.workspace_id=v_workspace
    and nd.kind=p_kind
    and nd.label=btrim(p_label)
  limit 1;

  if v_existing.id is null then
    select vault.create_secret(
      p_endpoint_url,
      'nodra-notification-' || v_workspace::text || '-' || gen_random_uuid()::text,
      'Nodra external notification endpoint',
      null
    ) into v_secret;

    insert into public.notification_destinations(
      workspace_id, kind, label, vault_secret_id, enabled, event_types, created_by
    ) values (
      v_workspace, p_kind, btrim(p_label), v_secret, true, coalesce(p_event_types,'{}'::text[]), v_user
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
  where ws.workspace_id=v_workspace;

  return query
  select nd.id, nd.kind, nd.label, nd.enabled, nd.event_types
  from public.notification_destinations nd
  where nd.id=v_existing.id;
end;
$$;

revoke all on function public.set_notification_destination(text,text,text,text[]) from public,anon;
grant execute on function public.set_notification_destination(text,text,text,text[]) to authenticated;

create or replace function public.delete_notification_destination(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_workspace uuid;
  v_role text;
  v_secret uuid;
begin
  select wm.workspace_id, wm.role into v_workspace, v_role
  from public.workspace_members wm
  where wm.user_id=v_user
  order by wm.workspace_id
  limit 1;

  if v_workspace is null then raise exception 'workspace_required'; end if;
  if v_role not in ('owner','admin') then raise exception 'insufficient_role'; end if;

  select nd.vault_secret_id into v_secret
  from public.notification_destinations nd
  where nd.id=p_id and nd.workspace_id=v_workspace;

  if v_secret is null then return false; end if;

  delete from public.notification_destinations
  where id=p_id and workspace_id=v_workspace;

  delete from vault.secrets where id=v_secret;

  if not exists (
    select 1 from public.notification_destinations nd
    where nd.workspace_id=v_workspace and nd.enabled
  ) then
    update public.workspace_settings
    set external_notifications_enabled=false, updated_at=clock_timestamp()
    where workspace_id=v_workspace;
  end if;

  return true;
end;
$$;

revoke all on function public.delete_notification_destination(uuid) from public,anon;
grant execute on function public.delete_notification_destination(uuid) to authenticated;

create or replace function public.enqueue_nodra_notification()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_settings public.workspace_settings%rowtype;
  v_kind text;
begin
  select * into v_settings
  from public.workspace_settings ws
  where ws.workspace_id=new.workspace_id;

  if not coalesce(v_settings.external_notifications_enabled,false) then
    return new;
  end if;

  v_kind := case
    when lower(coalesce(new.decision,''))='deny' then 'denial'
    when lower(coalesce(new.event_type,'')) similar to '%(contain|recover|restart|remediat)%' then 'recovery'
    else 'incident'
  end;

  if v_kind='denial' and not coalesce((v_settings.notifications->>'denialAlerts')::boolean,true) then return new; end if;
  if v_kind='recovery' and not coalesce((v_settings.notifications->>'recoveryAlerts')::boolean,true) then return new; end if;
  if v_kind='incident' and not coalesce((v_settings.notifications->>'incidentAlerts')::boolean,true) then return new; end if;

  insert into public.notification_outbox(workspace_id,event_kind,payload)
  values (
    new.workspace_id,
    v_kind,
    jsonb_build_object(
      'source','nodra',
      'kind',v_kind,
      'eventId',new.id,
      'incidentId',new.incident_id,
      'agentId',new.agent_id,
      'eventType',new.event_type,
      'action',new.action,
      'decision',new.decision,
      'occurredAt',new.occurred_at
    )
  );

  return new;
end;
$$;

drop trigger if exists security_events_external_notifications on public.security_events;
create trigger security_events_external_notifications
after insert on public.security_events
for each row execute function public.enqueue_nodra_notification();

create or replace function public.deliver_nodra_notifications()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row public.notification_outbox%rowtype;
  v_dest record;
  v_delivered integer := 0;
begin
  for v_row in
    select *
    from public.notification_outbox
    where delivered_at is null and attempt_count < 6
    order by created_at
    limit 50
    for update skip locked
  loop
    begin
      for v_dest in
        select nd.id, nd.kind, ds.decrypted_secret as endpoint
        from public.notification_destinations nd
        join vault.decrypted_secrets ds on ds.id=nd.vault_secret_id
        where nd.workspace_id=v_row.workspace_id
          and nd.enabled
          and v_row.event_kind = any(nd.event_types)
      loop
        perform net.http_post(
          url := v_dest.endpoint,
          body := jsonb_build_object(
            'text',
            '[Nodra] ' || upper(v_row.event_kind) || ' security event',
            'event',
            v_row.payload
          ),
          headers := '{"Content-Type":"application/json","User-Agent":"Nodra-Security-Notifier/1.0"}'::jsonb
        );
      end loop;

      update public.notification_outbox
      set delivered_at=clock_timestamp(),
          attempt_count=attempt_count+1,
          last_error=null
      where id=v_row.id;

      v_delivered := v_delivered + 1;
    exception when others then
      update public.notification_outbox
      set attempt_count=attempt_count+1,
          last_error=left(sqlerrm,500)
      where id=v_row.id;
    end;
  end loop;

  return v_delivered;
end;
$$;

revoke all on function public.deliver_nodra_notifications() from public,anon,authenticated;

do $$
begin
  if exists(select 1 from cron.job where jobname='nodra-retention-archive') then
    perform cron.unschedule('nodra-retention-archive');
  end if;
  perform cron.schedule(
    'nodra-retention-archive',
    '17 2 * * *',
    'select public.archive_expired_security_events();'
  );

  if exists(select 1 from cron.job where jobname='nodra-notification-delivery') then
    perform cron.unschedule('nodra-notification-delivery');
  end if;
  perform cron.schedule(
    'nodra-notification-delivery',
    '* * * * *',
    'select public.deliver_nodra_notifications();'
  );
end $$;
