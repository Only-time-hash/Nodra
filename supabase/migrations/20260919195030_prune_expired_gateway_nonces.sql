create or replace function public.prune_expired_gateway_nonces()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public.gateway_request_nonces
  where expires_at < now();
  return null;
end
$$;

revoke all on function public.prune_expired_gateway_nonces() from public, anon, authenticated;

create trigger prune_expired_gateway_nonces_before_insert
before insert on public.gateway_request_nonces
for each statement
execute function public.prune_expired_gateway_nonces();
