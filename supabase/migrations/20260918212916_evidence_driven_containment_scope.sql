create or replace function public.containment_scope(p_incident_id uuid)
returns table(agent_id uuid, external_id text, depth integer, action text)
language sql security invoker set search_path=''
as $$
with radius as (
 select * from public.incident_blast_radius(p_incident_id)
), origin as (
 select origin_agent_id from public.incidents where id=p_incident_id
)
select r.agent_id,r.external_id,r.depth,
 case when r.agent_id=(select origin_agent_id from origin) then 'quarantine'
      else 'restrict_authority' end::text
from radius r
order by r.depth,r.external_id;
$$;
revoke all on function public.containment_scope(uuid) from public;
grant execute on function public.containment_scope(uuid) to authenticated;

