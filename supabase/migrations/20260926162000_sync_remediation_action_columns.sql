alter table public.remediation_actions
  add column if not exists idempotency_key text,
  add column if not exists provider text not null default 'laboratory',
  add column if not exists attempt_count integer not null default 1,
  add column if not exists error_code text,
  add column if not exists last_error text;

alter table public.remediation_actions
  drop constraint if exists remediation_actions_attempt_count_check;

alter table public.remediation_actions
  add constraint remediation_actions_attempt_count_check
  check (attempt_count > 0);
