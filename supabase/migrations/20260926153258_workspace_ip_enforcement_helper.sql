create or replace function public.workspace_ip_allowed(p_workspace_id uuid, p_ip text)
returns boolean
language sql
stable
security invoker
set search_path=''
as $$
  select case
    when ws.ip_restrictions is not true then true
    when cardinality(ws.ip_allowlist)=0 then false
    when p_ip is null or btrim(p_ip)='' then false
    else exists (
      select 1
      from unnest(ws.ip_allowlist) allowed
      where p_ip::inet <<= allowed
    )
  end
  from public.workspace_settings ws
  where ws.workspace_id=p_workspace_id
$$;

revoke all on function public.workspace_ip_allowed(uuid,text) from public,anon;
grant execute on function public.workspace_ip_allowed(uuid,text) to authenticated;
