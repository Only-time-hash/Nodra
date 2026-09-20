-- Transactional production-schema test. Every fixture is rolled back.
-- Run as a database owner with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_workspace_isolation.sql

begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-a@nodra.invalid', '', now()),
  ('20000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-b@nodra.invalid', '', now());

insert into public.workspaces (id, owner_id, name, slug)
values
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'RLS Tenant A', 'rls-tenant-a-test'),
  ('b0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'RLS Tenant B', 'rls-tenant-b-test');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner'),
  ('b0000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'owner');

insert into public.agents (id, workspace_id, external_id, name)
values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'tenant-a-agent', 'Tenant A Agent'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'tenant-b-agent', 'Tenant B Agent');

insert into public.incidents (id, workspace_id, origin_agent_id, title, severity)
values
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Tenant A incident', 'high'),
  ('a2000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Tenant A second incident', 'medium'),
  ('b2000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'Tenant B incident', 'high');

insert into public.remediation_actions (
  id, workspace_id, incident_id, action_type, target, status, requested_by
)
values (
  'a4000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'patch_origin',
  'tenant-a-agent',
  'succeeded',
  '10000000-0000-4000-8000-000000000001'
);

do $$
declare denied boolean := false;
begin
  begin
    insert into public.remediation_evidence (
      workspace_id, incident_id, check_key, evidence_type, evidence_ref,
      source, adapter_action_id
    ) values (
      'a0000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000003',
      'originPatched',
      'adapter-success',
      'cross-incident-evidence',
      'nodra_adapter',
      'a4000000-0000-4000-8000-000000000001'
    );
  exception when others then
    denied := sqlerrm = 'remediation_evidence_incident_mismatch';
  end;
  if not denied then raise exception 'cross-incident remediation evidence was accepted'; end if;
end
$$;

insert into public.security_events (
  id, workspace_id, incident_id, agent_id, event_type, sequence_no, event_hash
)
values
  ('a3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'tenant-fixture', 1, repeat('a', 64)),
  ('b3000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'tenant-fixture', 1, repeat('b', 64));

insert into public.gateway_request_nonces (
  workspace_id, agent_id, nonce, request_timestamp, expires_at
) values (
  'a0000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'expired_nonce_123456789',
  now() - interval '10 minutes',
  now() - interval '5 minutes'
);

do $$
declare missing_rls text[];
declare missing_policy text[];
begin
  select array_agg(c.relname order by c.relname)
  into missing_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if missing_rls is not null then
    raise exception 'public tables without RLS: %', missing_rls;
  end if;

  select array_agg(c.relname order by c.relname)
  into missing_policy
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not exists (
      select 1 from pg_policy p where p.polrelid = c.oid
    );

  if missing_policy is not null then
    raise exception 'public tables without RLS policies: %', missing_policy;
  end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into public.gateway_request_nonces (
  workspace_id, agent_id, nonce, request_timestamp, expires_at
) values (
  'a0000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'signed_nonce_1234567890',
  now(),
  now() + interval '5 minutes'
);

do $$
declare replay_blocked boolean := false;
begin
  begin
    insert into public.gateway_request_nonces (
      workspace_id, agent_id, nonce, request_timestamp, expires_at
    ) values (
      'a0000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000001',
      'signed_nonce_1234567890',
      now(),
      now() + interval '5 minutes'
    );
  exception when unique_violation then
    replay_blocked := true;
  end;
  if not replay_blocked then raise exception 'signed gateway nonce replay was accepted'; end if;
end
$;

do $
declare cross_agent_blocked boolean := false;
begin
  begin
    insert into public.gateway_request_nonces (
      workspace_id, agent_id, nonce, request_timestamp, expires_at
    ) values (
      'a0000000-0000-4000-8000-000000000001',
      'b1000000-0000-4000-8000-000000000002',
      'cross_agent_nonce_1234567890',
      now(),
      now() + interval '5 minutes'
    );
  exception when others then
    cross_agent_blocked := true;
  end;
  if not cross_agent_blocked then raise exception 'cross-workspace agent nonce binding was accepted'; end if;
end
$;

do $$
begin
  if (select count(*) from public.workspaces) <> 1 then
    raise exception 'tenant A can enumerate another workspace';
  end if;
  if (select count(*) from public.agents) <> 1 then
    raise exception 'tenant A can enumerate another workspace agent';
  end if;
  if (select count(*) from public.incidents) <> 2 then
    raise exception 'tenant A can enumerate another workspace incident';
  end if;
  if (select count(*) from public.security_events) <> 1 then
    raise exception 'tenant A can enumerate another workspace security event';
  end if;
  if exists (
    select 1 from public.workspace_members
    where user_id = '20000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'tenant A can enumerate tenant B membership';
  end if;
end
$$;

do $$
declare denied boolean := false;
begin
  begin
    insert into public.security_events (
      workspace_id, incident_id, agent_id, event_type, sequence_no, event_hash
    ) values (
      'a0000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000001',
      'direct-ledger-write',
      2,
      repeat('c', 64)
    );
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then raise exception 'authenticated user inserted directly into security_events'; end if;
end
$$;

do $$
declare denied boolean := false;
begin
  begin
    insert into public.resources (workspace_id, external_id, name, kind)
    values ('b0000000-0000-4000-8000-000000000002', 'cross-tenant-write', 'Forbidden', 'test');
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then raise exception 'tenant A inserted a tenant B resource'; end if;
end
$$;

do $$
declare affected integer;
begin
  update public.agents set status = 'quarantined'
  where id = 'b1000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'tenant A updated a tenant B agent'; end if;
end
$$;

do $$
declare denied boolean := false;
begin
  begin
    perform public.record_gateway_intent(
      'b0000000-0000-4000-8000-000000000002',
      'b2000000-0000-4000-8000-000000000002',
      'b1000000-0000-4000-8000-000000000002',
      'cross-tenant-intent',
      '{}'::jsonb
    );
  exception when others then
    denied := sqlerrm = 'not_authorized';
  end;
  if not denied then raise exception 'gateway intent crossed the workspace boundary'; end if;
end
$$;

do $$
declare denied boolean := false;
begin
  begin
    perform public.append_security_event(
      'b0000000-0000-4000-8000-000000000002',
      'b2000000-0000-4000-8000-000000000002',
      'b1000000-0000-4000-8000-000000000002',
      'cross-tenant-test'
    );
  exception when others then
    denied := sqlerrm in ('workspace access denied', 'workspace or agent access denied');
  end;
  if not denied then raise exception 'security event append crossed the workspace boundary'; end if;
end
$$;

select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.workspaces) <> 1 then
    raise exception 'tenant B can enumerate another workspace';
  end if;
  if exists (
    select 1 from public.agents
    where id = 'a1000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'tenant B can read tenant A agent';
  end if;
end
$$;

reset role;

do $$
begin
  if exists (
    select 1 from public.gateway_request_nonces
    where nonce = 'expired_nonce_123456789'
  ) then
    raise exception 'expired gateway nonce was not pruned';
  end if;
end
$$;

rollback;

select 'workspace isolation passed' as result;
