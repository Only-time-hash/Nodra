create or replace function public.apply_critical_incident_agent_controls()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_pause boolean := false;
  v_agent public.agents%rowtype;
begin
  if lower(coalesce(new.severity,'')) <> 'critical' then
    return new;
  end if;

  if new.origin_agent_id is null then
    return new;
  end if;

  select coalesce((ws.agent_controls->>'pauseOnCritical')::boolean,false)
    into v_pause
  from public.workspace_settings ws
  where ws.workspace_id = new.workspace_id;

  if not coalesce(v_pause,false) then
    return new;
  end if;

  select a.* into v_agent
  from public.agents a
  where a.id = new.origin_agent_id
    and a.workspace_id = new.workspace_id
    and a.kind = 'customer'
  limit 1;

  if v_agent.id is null then
    return new;
  end if;

  if v_agent.status::text not in ('paused','quarantined') then
    update public.agents
      set status = 'paused'
    where id = v_agent.id;

    perform public.append_integration_security_event(
      new.workspace_id,
      new.id,
      v_agent.id,
      'agent-auto-paused',
      'agent.pause',
      null,
      null,
      null,
      pg_catalog.jsonb_build_object(
        'reason','critical_incident_auto_pause',
        'incidentSeverity',new.severity,
        'incidentTitle',new.title
      ),
      clock_timestamp()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists incidents_auto_pause_origin_agent on public.incidents;
create trigger incidents_auto_pause_origin_agent
after insert or update of severity
on public.incidents
for each row
execute function public.apply_critical_incident_agent_controls();
