create table if not exists public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  label text not null,
  secret_hash text not null,
  secret_prefix text not null,
  status text not null default 'active' check (status in ('active','revoked')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  rotated_from uuid references public.integration_credentials(id)
);
create index if not exists integration_credentials_workspace_agent_idx on public.integration_credentials(workspace_id,agent_id);
alter table public.integration_credentials enable row level security;
revoke all on public.integration_credentials from anon;
revoke all on public.integration_credentials from authenticated;

create policy integration_credentials_no_direct_client_access on public.integration_credentials for all to authenticated using (false) with check (false);
