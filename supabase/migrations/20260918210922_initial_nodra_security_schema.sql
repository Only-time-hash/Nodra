
create extension if not exists pgcrypto;

create type public.workspace_role as enum ('owner','admin','analyst','viewer');
create type public.agent_status as enum ('healthy','at_risk','quarantined','paused','offline');
create type public.incident_state as enum ('open','contained','recovering','resolved');
create type public.security_decision as enum ('allow','deny','require_approval');
create type public.recovery_status as enum ('pending','ready','completed','skipped');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_id text not null,
  name text not null,
  kind text not null default 'agent',
  status public.agent_status not null default 'healthy',
  authority_scope jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique(workspace_id,external_id)
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_id text not null,
  name text not null,
  kind text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(workspace_id,external_id)
);

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete cascade,
  resource_id uuid references public.resources(id) on delete cascade,
  action text not null,
  effect public.security_decision not null,
  constraints jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  origin_agent_id uuid references public.agents(id) on delete set null,
  state public.incident_state not null default 'open',
  title text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  opened_at timestamptz not null default now(),
  contained_at timestamptz,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table public.security_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  incident_id uuid references public.incidents(id) on delete set null,
  agent_id uuid references public.agents(id) on delete set null,
  event_type text not null,
  action text,
  resource_id uuid references public.resources(id) on delete set null,
  decision public.security_decision,
  caused_by_event_id uuid references public.security_events(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  sequence_no bigint not null,
  prev_hash text,
  event_hash text not null check (char_length(event_hash) >= 32),
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  unique(workspace_id,sequence_no)
);

create table public.causal_edges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  incident_id uuid references public.incidents(id) on delete cascade,
  from_agent_id uuid not null references public.agents(id) on delete cascade,
  to_agent_id uuid not null references public.agents(id) on delete cascade,
  event_id uuid references public.security_events(id) on delete set null,
  relation text not null check (relation in ('delegated','influenced','touched')),
  created_at timestamptz not null default now()
);

create table public.incident_affected_entities (
  incident_id uuid not null references public.incidents(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null check (entity_type in ('agent','resource','credential','job','memory','session','action')),
  entity_ref text not null,
  status text not null default 'affected',
  evidence_event_id uuid references public.security_events(id) on delete set null,
  primary key (incident_id,entity_type,entity_ref)
);

create table public.containment_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  incident_id uuid not null references public.incidents(id) on delete cascade,
  action_type text not null,
  target_type text not null,
  target_ref text not null,
  requested_by uuid references auth.users(id) on delete set null,
  reason text not null,
  result jsonb not null default '{}'::jsonb,
  executed_at timestamptz not null default now()
);

create table public.recovery_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  incident_id uuid not null unique references public.incidents(id) on delete cascade,
  safe_to_restart boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.recovery_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recovery_plan_id uuid not null references public.recovery_plans(id) on delete cascade,
  title text not null,
  reason text not null,
  requires_human boolean not null default true,
  status public.recovery_status not null default 'pending',
  completed_at timestamptz
);

create table public.credential_refs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  provider text not null,
  label text not null,
  secret_reference text not null,
  fingerprint text,
  status text not null default 'active' check (status in ('active','revoked','rotating')),
  last_rotated_at timestamptz,
  created_at timestamptz not null default now(),
  unique(workspace_id,secret_reference)
);

create index agents_workspace_idx on public.agents(workspace_id);
create index incidents_workspace_opened_idx on public.incidents(workspace_id,opened_at desc);
create index security_events_workspace_time_idx on public.security_events(workspace_id,occurred_at desc);
create index security_events_incident_idx on public.security_events(incident_id,sequence_no);
create index causal_edges_incident_idx on public.causal_edges(incident_id);
create index containment_actions_incident_idx on public.containment_actions(incident_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.agents enable row level security;
alter table public.resources enable row level security;
alter table public.policies enable row level security;
alter table public.incidents enable row level security;
alter table public.security_events enable row level security;
alter table public.causal_edges enable row level security;
alter table public.incident_affected_entities enable row level security;
alter table public.containment_actions enable row level security;
alter table public.recovery_plans enable row level security;
alter table public.recovery_steps enable row level security;
alter table public.credential_refs enable row level security;

create policy workspace_owner_all on public.workspaces
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy membership_read_self_or_owner on public.workspace_members
for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()
  )
);
create policy membership_owner_insert on public.workspace_members
for insert to authenticated with check (
  exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);
create policy membership_owner_update on public.workspace_members
for update to authenticated using (
  exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
) with check (
  exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);
create policy membership_owner_delete on public.workspace_members
for delete to authenticated using (
  exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid())
);

create policy agents_workspace_access on public.agents for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=agents.workspace_id and m.user_id=auth.uid()))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=agents.workspace_id and m.user_id=auth.uid()));
create policy resources_workspace_access on public.resources for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=resources.workspace_id and m.user_id=auth.uid()))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=resources.workspace_id and m.user_id=auth.uid()));
create policy policies_workspace_access on public.policies for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=policies.workspace_id and m.user_id=auth.uid()))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=policies.workspace_id and m.user_id=auth.uid()));
create policy incidents_workspace_access on public.incidents for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=incidents.workspace_id and m.user_id=auth.uid()))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=incidents.workspace_id and m.user_id=auth.uid()));

create policy events_workspace_select on public.security_events for select to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=security_events.workspace_id and m.user_id=auth.uid()));
create policy events_workspace_insert on public.security_events for insert to authenticated
with check (exists(select 1 from public.workspace_members m where m.workspace_id=security_events.workspace_id and m.user_id=auth.uid()));

create policy causal_workspace_access on public.causal_edges for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=causal_edges.workspace_id and m.user_id=auth.uid()))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=causal_edges.workspace_id and m.user_id=auth.uid()));
create policy affected_workspace_access on public.incident_affected_entities for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=incident_affected_entities.workspace_id and m.user_id=auth.uid()))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=incident_affected_entities.workspace_id and m.user_id=auth.uid()));
create policy containment_workspace_access on public.containment_actions for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=containment_actions.workspace_id and m.user_id=auth.uid()))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=containment_actions.workspace_id and m.user_id=auth.uid()));
create policy recovery_plans_workspace_access on public.recovery_plans for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_plans.workspace_id and m.user_id=auth.uid()))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_plans.workspace_id and m.user_id=auth.uid()));
create policy recovery_steps_workspace_access on public.recovery_steps for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_steps.workspace_id and m.user_id=auth.uid()))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_steps.workspace_id and m.user_id=auth.uid()));
create policy credential_refs_workspace_access on public.credential_refs for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=credential_refs.workspace_id and m.user_id=auth.uid()))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=credential_refs.workspace_id and m.user_id=auth.uid()));

revoke update, delete on public.security_events from authenticated;

