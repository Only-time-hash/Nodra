-- Resolve current Supabase advisor findings without broadening access.

create index if not exists gateway_outbox_agent_idx on public.gateway_outbox(agent_id);
create index if not exists gateway_outbox_incident_idx on public.gateway_outbox(incident_id);
create index if not exists remediation_actions_incident_idx on public.remediation_actions(incident_id);
create index if not exists remediation_actions_workspace_idx on public.remediation_actions(workspace_id);
create index if not exists remediation_evidence_adapter_action_idx on public.remediation_evidence(adapter_action_id);
create index if not exists remediation_evidence_workspace_idx on public.remediation_evidence(workspace_id);

alter policy "members read remediation evidence" on public.remediation_evidence
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id=remediation_evidence.workspace_id
    and wm.user_id=(select auth.uid())
));

alter policy "operators record operator evidence" on public.remediation_evidence
with check (
  source='operator'
  and adapter_action_id is null
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id=remediation_evidence.workspace_id
      and wm.user_id=(select auth.uid())
      and wm.role in ('owner','admin','analyst')
  )
);

alter policy "members read remediation actions" on public.remediation_actions
using (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id=remediation_actions.workspace_id
    and wm.user_id=(select auth.uid())
));

alter policy "operators create remediation actions" on public.remediation_actions
with check (exists (
  select 1 from public.workspace_members wm
  where wm.workspace_id=remediation_actions.workspace_id
    and wm.user_id=(select auth.uid())
    and wm.role in ('owner','admin','analyst')
));

-- Split ALL policies so their SELECT branch does not overlap the dedicated
-- workspace read policy. The predicates remain unchanged.
drop policy if exists causal_workspace_write on public.causal_edges;
create policy causal_workspace_insert on public.causal_edges for insert to authenticated
with check (exists(select 1 from public.workspace_members m where m.workspace_id=causal_edges.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy causal_workspace_update on public.causal_edges for update to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=causal_edges.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=causal_edges.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy causal_workspace_delete on public.causal_edges for delete to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=causal_edges.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));

drop policy if exists affected_workspace_write on public.incident_affected_entities;
create policy affected_workspace_insert on public.incident_affected_entities for insert to authenticated
with check (exists(select 1 from public.workspace_members m where m.workspace_id=incident_affected_entities.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy affected_workspace_update on public.incident_affected_entities for update to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=incident_affected_entities.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=incident_affected_entities.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy affected_workspace_delete on public.incident_affected_entities for delete to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=incident_affected_entities.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));

drop policy if exists credential_refs_workspace_write on public.credential_refs;
create policy credential_refs_workspace_insert on public.credential_refs for insert to authenticated
with check (exists(select 1 from public.workspace_members m where m.workspace_id=credential_refs.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy credential_refs_workspace_update on public.credential_refs for update to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=credential_refs.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=credential_refs.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy credential_refs_workspace_delete on public.credential_refs for delete to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=credential_refs.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy if exists resources_workspace_write on public.resources;
create policy resources_workspace_insert on public.resources for insert to authenticated
with check (exists(select 1 from public.workspace_members m where m.workspace_id=resources.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy resources_workspace_update on public.resources for update to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=resources.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=resources.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy resources_workspace_delete on public.resources for delete to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=resources.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy if exists recovery_steps_workspace_write on public.recovery_steps;
create policy recovery_steps_workspace_insert on public.recovery_steps for insert to authenticated
with check (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_steps.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy recovery_steps_workspace_update on public.recovery_steps for update to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_steps.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_steps.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy recovery_steps_workspace_delete on public.recovery_steps for delete to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_steps.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
