-- Transactional regression proof for enforceable workspace Settings.
begin;

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at)
values ('50000000-0000-4000-8000-000000000005','authenticated','authenticated','settings-e2e@nodra.invalid','',now());

insert into public.workspaces (id,owner_id,name,slug)
values ('e0000000-0000-4000-8000-000000000005','50000000-0000-4000-8000-000000000005','Settings E2E','settings-e2e-test');

insert into public.workspace_members(workspace_id,user_id,role)
values ('e0000000-0000-4000-8000-000000000005','50000000-0000-4000-8000-000000000005','owner');

insert into public.workspace_settings(
  workspace_id,ip_restrictions,ip_allowlist,event_retention_days,
  external_notifications_enabled,notifications
) values (
  'e0000000-0000-4000-8000-000000000005',
  true,
  array['203.0.113.0/24'::inet,'2001:db8::/32'::inet],
  30,
  false,
  '{"incidentAlerts":true,"denialAlerts":true,"recoveryAlerts":true}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2"}', true);

do $$
begin
  if public.workspace_ip_allowed('e0000000-0000-4000-8000-000000000005','203.0.113.42') is not true then
    raise exception 'allowed IPv4 address rejected';
  end if;
  if public.workspace_ip_allowed('e0000000-0000-4000-8000-000000000005','198.51.100.10') is not false then
    raise exception 'disallowed IPv4 address accepted';
  end if;
  if public.workspace_ip_allowed('e0000000-0000-4000-8000-000000000005','2001:db8::42') is not true then
    raise exception 'allowed IPv6 address rejected';
  end if;
  if public.workspace_ip_allowed('e0000000-0000-4000-8000-000000000005','2001:db9::1') is not false then
    raise exception 'disallowed IPv6 address accepted';
  end if;
end $$;

reset role;

insert into public.security_events(
  id,workspace_id,event_type,action,decision,payload,sequence_no,event_hash,occurred_at
) values (
  'e1000000-0000-4000-8000-000000000005',
  'e0000000-0000-4000-8000-000000000005',
  'retention-fixture',
  'settings.retention',
  'allow',
  '{"secret":"must-remain-in-archive-snapshot"}'::jsonb,
  1,
  repeat('e',64),
  clock_timestamp()-interval '31 days'
);

do $$
declare archived integer;
begin
  select public.archive_expired_security_events() into archived;
  if archived <> 1 then raise exception 'expected one archived event, got %', archived; end if;

  if not exists (
    select 1 from public.security_event_archives
    where source_event_id='e1000000-0000-4000-8000-000000000005'
      and workspace_id='e0000000-0000-4000-8000-000000000005'
  ) then
    raise exception 'retention worker did not create archive record';
  end if;

  if not exists (
    select 1 from public.security_events
    where id='e1000000-0000-4000-8000-000000000005'
      and archived_at is not null
  ) then
    raise exception 'source evidence was not marked archived';
  end if;
end $$;

do $$
begin
  if has_function_privilege('anon','public.enqueue_nodra_notification()','execute')
     or has_function_privilege('authenticated','public.enqueue_nodra_notification()','execute')
     or has_function_privilege('public','public.enqueue_nodra_notification()','execute') then
    raise exception 'notification trigger function is directly executable';
  end if;

  if has_function_privilege('anon','public.enqueue_nodra_incident_notification()','execute')
     or has_function_privilege('authenticated','public.enqueue_nodra_incident_notification()','execute')
     or has_function_privilege('public','public.enqueue_nodra_incident_notification()','execute') then
    raise exception 'incident notification trigger function is directly executable';
  end if;

  if has_function_privilege('authenticated','public.deliver_nodra_notifications()','execute')
     or has_function_privilege('anon','public.deliver_nodra_notifications()','execute')
     or has_function_privilege('public','public.deliver_nodra_notifications()','execute') then
    raise exception 'notification delivery worker is directly executable';
  end if;
end $$;

rollback;

select 'workspace settings security passed' as result;
