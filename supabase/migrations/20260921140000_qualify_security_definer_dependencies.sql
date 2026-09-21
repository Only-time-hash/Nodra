-- Keep SECURITY DEFINER functions safe with an empty search_path while
-- schema-qualifying objects that are not resolved through pg_catalog.
create or replace function public.append_security_event(
  p_workspace_id uuid,
  p_incident_id uuid,
  p_agent_id uuid,
  p_event_type text,
  p_action text default null,
  p_resource_id uuid default null,
  p_decision public.security_decision default null,
  p_caused_by_event_id uuid default null,
  p_payload jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns public.security_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq bigint;
  v_prev text;
  v_id uuid := pg_catalog.gen_random_uuid();
  v_hash text;
  v_row public.security_events;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()) then raise exception 'workspace access denied'; end if;
  if p_incident_id is not null and not exists(select 1 from public.incidents i where i.id=p_incident_id and i.workspace_id=p_workspace_id) then raise exception 'incident_workspace_mismatch'; end if;
  if p_agent_id is not null and not exists(select 1 from public.agents a where a.id=p_agent_id and a.workspace_id=p_workspace_id) then raise exception 'agent_workspace_mismatch'; end if;
  if p_resource_id is not null and not exists(select 1 from public.resources r where r.id=p_resource_id and r.workspace_id=p_workspace_id) then raise exception 'resource_workspace_mismatch'; end if;
  if p_caused_by_event_id is not null and not exists(select 1 from public.security_events e where e.id=p_caused_by_event_id and e.workspace_id=p_workspace_id) then raise exception 'caused_by_event_workspace_mismatch'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text,0));
  select sequence_no,event_hash into v_seq,v_prev from public.security_events where workspace_id=p_workspace_id order by sequence_no desc limit 1;
  v_seq := coalesce(v_seq,0)+1;
  v_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'id',v_id,'workspace_id',p_workspace_id,'incident_id',p_incident_id,'agent_id',p_agent_id,
          'event_type',p_event_type,'action',p_action,'resource_id',p_resource_id,'decision',p_decision,
          'caused_by_event_id',p_caused_by_event_id,'payload',coalesce(p_payload,'{}'::jsonb),
          'sequence_no',v_seq,'prev_hash',v_prev,'occurred_at',p_occurred_at
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.security_events(id,workspace_id,incident_id,agent_id,event_type,action,resource_id,decision,caused_by_event_id,payload,sequence_no,prev_hash,event_hash,occurred_at)
  values(v_id,p_workspace_id,p_incident_id,p_agent_id,p_event_type,p_action,p_resource_id,p_decision,p_caused_by_event_id,coalesce(p_payload,'{}'::jsonb),v_seq,v_prev,v_hash,p_occurred_at)
  returning * into v_row;
  return v_row;
end
$$;

create or replace function public.reset_laboratory(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.workspace_role;
  v_count integer;
  v_skipped integer;
begin
  select role into v_role from public.workspace_members
  where workspace_id=p_workspace_id and user_id=auth.uid();
  if v_role is null then raise exception 'workspace access denied'; end if;
  if v_role not in ('owner','admin','analyst') then raise exception 'insufficient role'; end if;

  update public.recovery_steps rs
  set status='skipped', completed_at=coalesce(rs.completed_at,now()),
      reason=case when rs.reason like '%[laboratory reset]%' then rs.reason else rs.reason || ' [laboratory reset]' end
  from public.recovery_plans rp join public.incidents i on i.id=rp.incident_id
  where rs.recovery_plan_id=rp.id and rs.workspace_id=p_workspace_id and rp.workspace_id=p_workspace_id
    and i.workspace_id=p_workspace_id and i.metadata->>'source'='nodra-v0.1-lab'
    and i.state<>'resolved' and rs.status not in ('ready','completed','skipped');
  get diagnostics v_skipped = row_count;

  update public.recovery_plans rp set safe_to_restart=false
  from public.incidents i
  where rp.incident_id=i.id and rp.workspace_id=p_workspace_id and i.workspace_id=p_workspace_id
    and i.metadata->>'source'='nodra-v0.1-lab' and i.state<>'resolved';

  update public.incidents
  set state='resolved', resolved_at=coalesce(resolved_at,now()),
      metadata=coalesce(metadata,'{}'::jsonb) || pg_catalog.jsonb_build_object('laboratory_reset_at',now(),'resolution_method','laboratory_reset')
  where workspace_id=p_workspace_id and metadata->>'source'='nodra-v0.1-lab' and state<>'resolved';
  get diagnostics v_count = row_count;

  update public.agents set status='healthy', authority_scope='{}'::jsonb
  where workspace_id=p_workspace_id and kind='laboratory';
  delete from public.laboratory_security_state where workspace_id=p_workspace_id;

  return pg_catalog.jsonb_build_object('reset',true,'incidents_resolved',v_count,'recovery_steps_skipped',v_skipped,'evidence_preserved',true,'resolution_method','laboratory_reset');
end
$$;

revoke all on function public.append_security_event(uuid,uuid,uuid,text,text,uuid,public.security_decision,uuid,jsonb,timestamptz) from public, anon;
grant execute on function public.append_security_event(uuid,uuid,uuid,text,text,uuid,public.security_decision,uuid,jsonb,timestamptz) to authenticated;
revoke all on function public.reset_laboratory(uuid) from public, anon;
grant execute on function public.reset_laboratory(uuid) to authenticated;
