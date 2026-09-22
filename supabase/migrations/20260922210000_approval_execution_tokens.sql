alter table public.approval_decisions add column if not exists execution_token_hash text;
alter table public.approval_decisions add column if not exists execution_token_expires_at timestamptz;
alter table public.approval_decisions add column if not exists consumed_at timestamptz;
create index if not exists approval_decisions_token_idx on public.approval_decisions(execution_token_hash) where execution_token_hash is not null and consumed_at is null;
