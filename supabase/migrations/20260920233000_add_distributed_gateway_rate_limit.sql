create table public.gateway_rate_limits (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null,
  bucket_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, agent_id, bucket_start),
  constraint gateway_rate_limit_agent_workspace_fkey foreign key (workspace_id, agent_id)
    references public.agents(workspace_id, id) on delete cascade
);

alter table public.gateway_rate_limits enable row level security;
revoke all on public.gateway_rate_limits from public, anon, authenticated;
grant all on public.gateway_rate_limits to service_role;

create or replace function public.consume_gateway_rate_limit(
  p_workspace_id uuid, p_agent_id uuid
) returns table(allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql security definer set search_path = public as $$
declare v_bucket timestamptz; v_count integer; v_now timestamptz := clock_timestamp();
begin
  if auth.uid() is null or not exists (select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=auth.uid())
    then raise exception 'not_authorized'; end if;
  if not exists (select 1 from public.agents where id=p_agent_id and workspace_id=p_workspace_id)
    then raise exception 'agent_workspace_mismatch'; end if;
  v_bucket := to_timestamp(floor(extract(epoch from v_now)/60)*60);
  insert into public.gateway_rate_limits(workspace_id,agent_id,bucket_start,request_count,updated_at)
  values(p_workspace_id,p_agent_id,v_bucket,1,v_now)
  on conflict(workspace_id,agent_id,bucket_start) do update
    set request_count=public.gateway_rate_limits.request_count+1, updated_at=excluded.updated_at
  returning request_count into v_count;
  return query select v_count<=240, greatest(240-v_count,0),
    greatest(1,ceil(extract(epoch from (v_bucket+interval '60 seconds'-v_now)))::integer);
end $$;
revoke all on function public.consume_gateway_rate_limit(uuid,uuid) from public, anon;
grant execute on function public.consume_gateway_rate_limit(uuid,uuid) to authenticated, service_role;
