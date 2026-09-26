-- Transactional end-to-end proof for production customer containment and recovery.
-- Applies real authenticated-role controls and rolls every fixture back.

begin;

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at)
values ('30000000-0000-4000-8000-000000000003','authenticated','authenticated','recovery-e2e@nodra.invalid','',now());

insert into public.workspaces (id,owner_id,name,slug)
values ('c0000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','Recovery E2E','recovery-e2e-test');

insert into public.workspace_members(workspace_id,user_id,role)
values ('c0000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','owner');

insert into public.agents(id,workspace_id,external_id,name,authority_scope,status,kind)
values ('c1000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000003','e2e-finance-agent','E2E Finance','["payments.submit"]'::jsonb,'healthy','customer');

insert into public.integration_credentials(id,workspace_id,agent_id,label,secret_hash,secret_prefix,status,created_by)
values ('c2000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000003','Initial',repeat('a',64),'ndra_old','active','30000000-0000-4000-8000-000000000003');

insert into public.incidents(id,workspace_id,origin_agent_id,title,severity,state,metadata)
values ('c3000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000003','E2E recovery incident','high','open','{"source":"runtime-gateway"}');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}',true);

select public.contain_customer_incident('c3000000-0000-4000-8000-000000000003');
select public.start_customer_recovery('c3000000-0000-4000-8000-000000000003');

select public.run_customer_recovery_action(
  'c3000000-0000-4000-8000-000000000003',
  'verify_origin_remediated',
  'Origin patched and independently verified.',
  null,
  null
);

select public.run_customer_recovery_action(
  'c3000000-0000-4000-8000-000000000003',
  'rotate_credentials',
  null,
  repeat('b',64),
  'ndra_new'
);

select public.run_customer_recovery_action(
  'c3000000-0000-4000-8000-000000000003',
  'review_memory',
  'Memory and persisted state reviewed and verified safe.',
  null,
  null
);

select public.run_customer_recovery_action(
  'c3000000-0000-4000-8000-000000000003',
  'cancel_pending_jobs',
  'Pending Nodra work cancelled and external work queue reviewed.',
  null,
  null
);

update public.recovery_plans
set restart_checks=restart_checks||'{"humanApproved":true}'::jsonb,
    approved_by='30000000-0000-4000-8000-000000000003',
    approved_at=clock_timestamp()
where incident_id='c3000000-0000-4000-8000-000000000003';

do $$
declare ok boolean;
begin
  select public.complete_incident_restart('c3000000-0000-4000-8000-000000000003') into ok;
  if not ok then raise exception 'safe restart gate did not open'; end if;
end $$;

reset role;

do $$
begin
  if (select status::text from public.agents where id='c1000000-0000-4000-8000-000000000003') <> 'healthy' then
    raise exception 'agent was not restored healthy';
  end if;

  if (select state::text from public.incidents where id='c3000000-0000-4000-8000-000000000003') <> 'resolved' then
    raise exception 'incident was not resolved';
  end if;

  if (select status::text from public.integration_credentials where id='c2000000-0000-4000-8000-000000000003') <> 'revoked' then
    raise exception 'old credential was not revoked';
  end if;

  if not exists(
    select 1
    from public.integration_credentials
    where agent_id='c1000000-0000-4000-8000-000000000003'
      and secret_prefix='ndra_new'
      and status='active'
  ) then
    raise exception 'rotated credential was not created';
  end if;

  if (select count(*) from public.remediation_evidence where incident_id='c3000000-0000-4000-8000-000000000003') < 4 then
    raise exception 'recovery evidence incomplete';
  end if;
end $$;

rollback;

select 'customer recovery e2e passed' as result;
