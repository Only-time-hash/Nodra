create or replace function public.incident_blast_radius(p_incident_id uuid)
returns table(agent_id uuid, external_id text, depth integer)
language sql
security invoker
set search_path=''
as $$
with recursive walk(agent_id,depth,path) as (
 select i.origin_agent_id,0,array[i.origin_agent_id]
 from public.incidents i
 where i.id=p_incident_id and i.origin_agent_id is not null
 union all
 select e.to_agent_id,w.depth+1,w.path||e.to_agent_id
 from walk w join public.causal_edges e on e.from_agent_id=w.agent_id
 where e.incident_id=p_incident_id and not e.to_agent_id=any(w.path)
)
select w.agent_id,a.external_id,min(w.depth)::integer
from walk w join public.agents a on a.id=w.agent_id
group by w.agent_id,a.external_id;
$$;
revoke all on function public.incident_blast_radius(uuid) from public;
grant execute on function public.incident_blast_radius(uuid) to authenticated;

