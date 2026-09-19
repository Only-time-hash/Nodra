
create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
create index if not exists workspaces_owner_idx on public.workspaces(owner_id);
create index if not exists policies_workspace_idx on public.policies(workspace_id);
create index if not exists policies_agent_idx on public.policies(agent_id);
create index if not exists policies_resource_idx on public.policies(resource_id);
create index if not exists incidents_origin_agent_idx on public.incidents(origin_agent_id);
create index if not exists security_events_agent_idx on public.security_events(agent_id);
create index if not exists security_events_resource_idx on public.security_events(resource_id);
create index if not exists security_events_caused_by_idx on public.security_events(caused_by_event_id);
create index if not exists causal_edges_workspace_idx on public.causal_edges(workspace_id);
create index if not exists causal_edges_from_agent_idx on public.causal_edges(from_agent_id);
create index if not exists causal_edges_to_agent_idx on public.causal_edges(to_agent_id);
create index if not exists causal_edges_event_idx on public.causal_edges(event_id);
create index if not exists affected_workspace_idx on public.incident_affected_entities(workspace_id);
create index if not exists affected_evidence_event_idx on public.incident_affected_entities(evidence_event_id);
create index if not exists containment_workspace_idx on public.containment_actions(workspace_id);
create index if not exists containment_requested_by_idx on public.containment_actions(requested_by);
create index if not exists recovery_plans_workspace_idx on public.recovery_plans(workspace_id);
create index if not exists recovery_plans_approved_by_idx on public.recovery_plans(approved_by);
create index if not exists recovery_steps_workspace_idx on public.recovery_steps(workspace_id);
create index if not exists recovery_steps_plan_idx on public.recovery_steps(recovery_plan_id);
create index if not exists credential_refs_agent_idx on public.credential_refs(agent_id);

alter policy workspace_owner_all on public.workspaces using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
alter policy membership_read_self_or_owner on public.workspace_members using (user_id=(select auth.uid()) or exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
alter policy membership_owner_insert on public.workspace_members with check (exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
alter policy membership_owner_update on public.workspace_members using (exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid()))) with check (exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));
alter policy membership_owner_delete on public.workspace_members using (exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())));

alter policy agents_workspace_access on public.agents using (exists(select 1 from public.workspace_members m where m.workspace_id=agents.workspace_id and m.user_id=(select auth.uid()))) with check (exists(select 1 from public.workspace_members m where m.workspace_id=agents.workspace_id and m.user_id=(select auth.uid())));
alter policy resources_workspace_access on public.resources using (exists(select 1 from public.workspace_members m where m.workspace_id=resources.workspace_id and m.user_id=(select auth.uid()))) with check (exists(select 1 from public.workspace_members m where m.workspace_id=resources.workspace_id and m.user_id=(select auth.uid())));
alter policy policies_workspace_access on public.policies using (exists(select 1 from public.workspace_members m where m.workspace_id=policies.workspace_id and m.user_id=(select auth.uid()))) with check (exists(select 1 from public.workspace_members m where m.workspace_id=policies.workspace_id and m.user_id=(select auth.uid())));
alter policy incidents_workspace_access on public.incidents using (exists(select 1 from public.workspace_members m where m.workspace_id=incidents.workspace_id and m.user_id=(select auth.uid()))) with check (exists(select 1 from public.workspace_members m where m.workspace_id=incidents.workspace_id and m.user_id=(select auth.uid())));
alter policy events_workspace_select on public.security_events using (exists(select 1 from public.workspace_members m where m.workspace_id=security_events.workspace_id and m.user_id=(select auth.uid())));
alter policy events_workspace_insert on public.security_events with check (exists(select 1 from public.workspace_members m where m.workspace_id=security_events.workspace_id and m.user_id=(select auth.uid())));
alter policy causal_workspace_access on public.causal_edges using (exists(select 1 from public.workspace_members m where m.workspace_id=causal_edges.workspace_id and m.user_id=(select auth.uid()))) with check (exists(select 1 from public.workspace_members m where m.workspace_id=causal_edges.workspace_id and m.user_id=(select auth.uid())));
alter policy affected_workspace_access on public.incident_affected_entities using (exists(select 1 from public.workspace_members m where m.workspace_id=incident_affected_entities.workspace_id and m.user_id=(select auth.uid()))) with check (exists(select 1 from public.workspace_members m where m.workspace_id=incident_affected_entities.workspace_id and m.user_id=(select auth.uid())));
alter policy containment_workspace_access on public.containment_actions using (exists(select 1 from public.workspace_members m where m.workspace_id=containment_actions.workspace_id and m.user_id=(select auth.uid()))) with check (exists(select 1 from public.workspace_members m where m.workspace_id=containment_actions.workspace_id and m.user_id=(select auth.uid())));
alter policy recovery_plans_workspace_access on public.recovery_plans using (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_plans.workspace_id and m.user_id=(select auth.uid()))) with check (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_plans.workspace_id and m.user_id=(select auth.uid())));
alter policy recovery_steps_workspace_access on public.recovery_steps using (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_steps.workspace_id and m.user_id=(select auth.uid()))) with check (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_steps.workspace_id and m.user_id=(select auth.uid())));
alter policy credential_refs_workspace_access on public.credential_refs using (exists(select 1 from public.workspace_members m where m.workspace_id=credential_refs.workspace_id and m.user_id=(select auth.uid()))) with check (exists(select 1 from public.workspace_members m where m.workspace_id=credential_refs.workspace_id and m.user_id=(select auth.uid())));

