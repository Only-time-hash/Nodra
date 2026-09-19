
drop policy if exists incidents_workspace_access on public.incidents;
create policy incidents_workspace_read on public.incidents for select to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=incidents.workspace_id and m.user_id=(select auth.uid())));
create policy incidents_workspace_write on public.incidents for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=incidents.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=incidents.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));

drop policy if exists containment_workspace_access on public.containment_actions;
create policy containment_workspace_read on public.containment_actions for select to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=containment_actions.workspace_id and m.user_id=(select auth.uid())));
create policy containment_workspace_write on public.containment_actions for insert to authenticated
with check (exists(select 1 from public.workspace_members m where m.workspace_id=containment_actions.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));

drop policy if exists recovery_plans_workspace_access on public.recovery_plans;
create policy recovery_plans_workspace_read on public.recovery_plans for select to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_plans.workspace_id and m.user_id=(select auth.uid())));
create policy recovery_plans_workspace_write on public.recovery_plans for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_plans.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_plans.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));

