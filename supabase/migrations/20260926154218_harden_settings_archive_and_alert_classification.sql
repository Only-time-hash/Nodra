alter table public.security_event_archives
  drop constraint if exists security_event_archives_source_event_id_fkey;

alter table public.security_event_archives
  add constraint security_event_archives_source_event_id_fkey
  foreign key (source_event_id) references public.security_events(id) on delete restrict;

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
    when lower(coalesce(new.event_type,'')) similar to '%(contain|recover|restart|remediat|quarantin)%' then 'recovery'
    when lower(coalesce(new.event_type,'')) similar to '%(incident|critical|alert)%' then 'incident'
    else null
  end;

  if v_kind is null then return new; end if;
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

create or replace function public.enqueue_nodra_incident_notification()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_settings public.workspace_settings%rowtype;
begin
  select * into v_settings
  from public.workspace_settings ws
  where ws.workspace_id=new.workspace_id;

  if not coalesce(v_settings.external_notifications_enabled,false)
     or not coalesce((v_settings.notifications->>'incidentAlerts')::boolean,true) then
    return new;
  end if;

  if tg_op='UPDATE'
     and old.state is not distinct from new.state
     and old.severity is not distinct from new.severity then
    return new;
  end if;

  insert into public.notification_outbox(workspace_id,event_kind,payload)
  values (
    new.workspace_id,
    'incident',
    jsonb_build_object(
      'source','nodra',
      'kind','incident',
      'incidentId',new.id,
      'title',new.title,
      'severity',new.severity,
      'state',new.state,
      'openedAt',new.opened_at,
      'containedAt',new.contained_at,
      'resolvedAt',new.resolved_at
    )
  );

  return new;
end;
$$;

drop trigger if exists incidents_external_notifications on public.incidents;
create trigger incidents_external_notifications
after insert or update of state,severity on public.incidents
for each row execute function public.enqueue_nodra_incident_notification();
