-- Store one-time signed gateway request nonces. The signature is verified by the
-- application before this table is touched; the unique key makes replay races atomic.

alter table public.agents
  add constraint agents_workspace_id_id_key unique (workspace_id, id);

create table public.gateway_request_nonces (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null,
  nonce text not null check (nonce ~ '^[A-Za-z0-9_-]{20,128}$'),
  request_timestamp timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (agent_id, nonce),
  constraint gateway_request_nonce_agent_workspace_fkey
    foreign key (workspace_id, agent_id)
    references public.agents(workspace_id, id)
    on delete cascade,
  constraint gateway_request_nonce_expiry_check
    check (expires_at > request_timestamp)
);

create index gateway_request_nonces_expiry_idx
  on public.gateway_request_nonces(expires_at);

alter table public.gateway_request_nonces enable row level security;

create policy gateway_nonce_insert_for_workspace_member
on public.gateway_request_nonces
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workspace_members member
    where member.workspace_id = gateway_request_nonces.workspace_id
      and member.user_id = (select auth.uid())
  )
);

revoke all on public.gateway_request_nonces from public, anon, authenticated;
grant insert on public.gateway_request_nonces to authenticated;
grant all on public.gateway_request_nonces to service_role;
