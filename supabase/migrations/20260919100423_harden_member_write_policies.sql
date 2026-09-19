
drop policy if exists causal_workspace_access on public.causal_edges;
create policy causal_workspace_read on public.causal_edges for select to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=causal_edges.workspace_id and m.user_id=(select auth.uid())));
create policy causal_workspace_write on public.causal_edges for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=causal_edges.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=causal_edges.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));

drop policy if exists affected_workspace_access on public.incident_affected_entities;
create policy affected_workspace_read on public.incident_affected_entities for select to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=incident_affected_entities.workspace_id and m.user_id=(select auth.uid())));
create policy affected_workspace_write on public.incident_affected_entities for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=incident_affected_entities.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=incident_affected_entities.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));

drop policy if exists credential_refs_workspace_access on public.credential_refs;
create policy credential_refs_workspace_read on public.credential_refs for select to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=credential_refs.workspace_id and m.user_id=(select auth.uid())));
create policy credential_refs_workspace_write on public.credential_refs for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=credential_refs.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=credential_refs.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy if exists resources_workspace_access on public.resources;
create policy resources_workspace_read on public.resources for select to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=resources.workspace_id and m.user_id=(select auth.uid())));
create policy resources_workspace_write on public.resources for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=resources.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=resources.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy if exists recovery_steps_workspace_access on public.recovery_steps;
create policy recovery_steps_workspace_read on public.recovery_steps for select to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_steps.workspace_id and m.user_id=(select auth.uid())));
create policy recovery_steps_workspace_write on public.recovery_steps for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_steps.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_steps.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));

drop policy if exists events_workspace_insert on public.security_events;

