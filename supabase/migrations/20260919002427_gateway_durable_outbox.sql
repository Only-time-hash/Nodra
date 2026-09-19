create table if not exists public.gateway_outbox (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 incident_id uuid references public.incidents(id) on delete set null,
 agent_id uuid references public.agents(id) on delete set null,
 request_id text not null,
 phase text not null check (phase in ('intent','result')),
 payload jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 delivered_at timestamptz,
 unique(workspace_id,request_id,phase)
);
alter table public.gateway_outbox enable row level security;
drop policy if exists gateway_outbox_workspace_access on public.gateway_outbox;
create policy gateway_outbox_workspace_access on public.gateway_outbox for select to authenticated using (exists(select 1 from public.workspace_members m where m.workspace_id=gateway_outbox.workspace_id and m.user_id=(select auth.uid())));
revoke all on public.gateway_outbox from anon;
grant select on public.gateway_outbox to authenticated;

create or replace function public.record_gateway_intent(
 p_workspace_id uuid,p_incident_id uuid,p_agent_id uuid,p_request_id text,p_payload jsonb
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
 if not exists(select 1 from workspace_members where workspace_id=p_workspace_id and user_id=auth.uid()) then raise exception 'not_authorized'; end if;
 insert into gateway_outbox(workspace_id,incident_id,agent_id,request_id,phase,payload)
 values(p_workspace_id,p_incident_id,p_agent_id,p_request_id,'intent',coalesce(p_payload,'{}'::jsonb))
 on conflict(workspace_id,request_id,phase) do update set payload=excluded.payload
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.record_gateway_intent(uuid,uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.record_gateway_intent(uuid,uuid,uuid,text,jsonb) to authenticated;
grant insert,update on public.gateway_outbox to authenticated;

