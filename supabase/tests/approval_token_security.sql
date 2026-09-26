-- Transactional security proof for automatic approval claims and one-time execution.

begin;

insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at)
values ('40000000-0000-4000-8000-000000000004','authenticated','authenticated','approval-e2e@nodra.invalid','',now());

insert into public.workspaces (id,owner_id,name,slug)
values ('d0000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000004','Approval E2E','approval-e2e-test');

insert into public.workspace_members(workspace_id,user_id,role)
values ('d0000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000004','owner');

insert into public.agents(id,workspace_id,external_id,name,authority_scope,status,kind)
values (
  'd1000000-0000-4000-8000-000000000004',
  'd0000000-0000-4000-8000-000000000004',
  'approval-finance-agent','Approval Finance',
  '["payments.submit"]'::jsonb,'healthy','customer'
);

insert into public.integration_credentials(
  id,workspace_id,agent_id,label,secret_hash,secret_prefix,status,created_by
) values (
  'd2000000-0000-4000-8000-000000000004',
  'd0000000-0000-4000-8000-000000000004',
  'd1000000-0000-4000-8000-000000000004',
  'Approval credential',repeat('c',64),'ndra_approval','active',
  '40000000-0000-4000-8000-000000000004'
);

insert into public.security_events(
  id,workspace_id,agent_id,event_type,action,decision,payload,sequence_no,event_hash,occurred_at
) values (
  'd3000000-0000-4000-8000-000000000004',
  'd0000000-0000-4000-8000-000000000004',
  'd1000000-0000-4000-8000-000000000004',
  'approval-required','payments.submit','require_approval',
  '{"resourceId":"stripe"}'::jsonb,1,repeat('d',64),clock_timestamp()
),(
  'd3000000-0000-4000-8000-000000000005',
  'd0000000-0000-4000-8000-000000000004',
  'd1000000-0000-4000-8000-000000000004',
  'approval-required','payments.submit','require_approval',
  '{"resourceId":"stripe"}'::jsonb,2,repeat('e',64),clock_timestamp()
);

insert into public.approval_decisions(
  workspace_id,security_event_id,decided_by,decision,reason
) values (
  'd0000000-0000-4000-8000-000000000004',
  'd3000000-0000-4000-8000-000000000004',
  '40000000-0000-4000-8000-000000000004',
  'approved','Approved for E2E'
),(
  'd0000000-0000-4000-8000-000000000004',
  'd3000000-0000-4000-8000-000000000005',
  '40000000-0000-4000-8000-000000000004',
  'approved','Approved for expiry test'
);

set local role anon;

-- Expired claim requests fail before token binding.
do $$
declare blocked boolean:=false;
begin
  begin
    perform * from public.claim_integration_approval_token(
      repeat('c',64),'approval-finance-agent',
      'd3000000-0000-4000-8000-000000000005',
      'stripe','payments.submit',repeat('f',64),clock_timestamp()-interval '1 second'
    );
  exception when others then
    blocked:=sqlerrm='invalid_approval_token_expiry';
  end;
  if not blocked then raise exception 'expired approval token claim was accepted'; end if;
end $$;

-- Malformed hashes fail at the database boundary.
do $$
declare blocked boolean:=false;
begin
  begin
    perform * from public.claim_integration_approval_token(
      repeat('c',64),'approval-finance-agent',
      'd3000000-0000-4000-8000-000000000004',
      'stripe','payments.submit','not-a-sha256',clock_timestamp()+interval '5 minutes'
    );
  exception when others then
    blocked:=sqlerrm='invalid_approval_token_hash';
  end;
  if not blocked then raise exception 'malformed approval token hash was accepted'; end if;
end $$;

-- First claim succeeds.
select * from public.claim_integration_approval_token(
  repeat('c',64),'approval-finance-agent',
  'd3000000-0000-4000-8000-000000000004',
  'stripe','payments.submit',repeat('a',64),clock_timestamp()+interval '5 minutes'
);

-- Same hash is idempotent before consumption.
select * from public.claim_integration_approval_token(
  repeat('c',64),'approval-finance-agent',
  'd3000000-0000-4000-8000-000000000004',
  'stripe','payments.submit',repeat('a',64),clock_timestamp()+interval '5 minutes'
);

-- A different runtime token cannot replace the claimed token.
do $$
declare blocked boolean:=false;
begin
  begin
    perform * from public.claim_integration_approval_token(
      repeat('c',64),'approval-finance-agent',
      'd3000000-0000-4000-8000-000000000004',
      'stripe','payments.submit',repeat('b',64),clock_timestamp()+interval '5 minutes'
    );
  exception when others then
    blocked:=sqlerrm='approval_token_already_claimed';
  end;
  if not blocked then raise exception 'approval token claim was replaced'; end if;
end $$;

-- Consume once.
select * from public.execute_approved_integration_action(
  repeat('c',64),'approval-finance-agent','approval_nonce_000000000001',
  clock_timestamp(),clock_timestamp()+interval '5 minutes',
  'd3000000-0000-4000-8000-000000000004',
  repeat('a',64),'stripe','payments.submit'
);

-- A fresh signed request cannot consume the same approval twice.
do $$
declare blocked boolean:=false;
begin
  begin
    perform * from public.execute_approved_integration_action(
      repeat('c',64),'approval-finance-agent','approval_nonce_000000000002',
      clock_timestamp(),clock_timestamp()+interval '5 minutes',
      'd3000000-0000-4000-8000-000000000004',
      repeat('a',64),'stripe','payments.submit'
    );
  exception when others then
    blocked:=sqlerrm='approval_token_invalid_expired_or_consumed';
  end;
  if not blocked then raise exception 'approval token replay was accepted'; end if;
end $$;

-- Reusing the exact signed nonce is independently rejected as request replay.
do $$
declare blocked boolean:=false;
begin
  begin
    perform * from public.execute_approved_integration_action(
      repeat('c',64),'approval-finance-agent','approval_nonce_000000000001',
      clock_timestamp(),clock_timestamp()+interval '5 minutes',
      'd3000000-0000-4000-8000-000000000004',
      repeat('a',64),'stripe','payments.submit'
    );
  exception when others then
    blocked:=sqlerrm='gateway_request_replayed';
  end;
  if not blocked then raise exception 'approved execution nonce replay was accepted'; end if;
end $$;

reset role;
rollback;

select 'approval token security passed' as result;
