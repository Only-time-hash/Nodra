create table if not exists public.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  security_event_id uuid not null references public.security_events(id) on delete cascade,
  decided_by uuid not null,
  decision text not null check (decision in ('approved','denied')),
  reason text,
  decided_at timestamptz not null default now(),
  constraint approval_decisions_event_once unique (workspace_id, security_event_id)
);
create index if not exists approval_decisions_workspace_decided_idx on public.approval_decisions(workspace_id,decided_at desc);
alter table public.approval_decisions enable row level security;
revoke all on public.approval_decisions from anon;
revoke all on public.approval_decisions from authenticated;
revoke all on public.approval_decisions from service_role;
grant select, insert on public.approval_decisions to service_role;
create policy approval_decisions_no_direct_client_access on public.approval_decisions for all to authenticated using (false) with check (false);
