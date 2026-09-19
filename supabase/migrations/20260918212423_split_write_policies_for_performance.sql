
drop policy if exists agents_workspace_write on public.agents;
create policy agents_insert on public.agents for insert to authenticated with check (exists(select 1 from public.workspace_members m where m.workspace_id=agents.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy agents_update on public.agents for update to authenticated using (exists(select 1 from public.workspace_members m where m.workspace_id=agents.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))) with check (exists(select 1 from public.workspace_members m where m.workspace_id=agents.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy agents_delete on public.agents for delete to authenticated using (exists(select 1 from public.workspace_members m where m.workspace_id=agents.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy if exists policies_workspace_write on public.policies;
create policy policies_insert on public.policies for insert to authenticated with check (exists(select 1 from public.workspace_members m where m.workspace_id=policies.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy policies_update on public.policies for update to authenticated using (exists(select 1 from public.workspace_members m where m.workspace_id=policies.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))) with check (exists(select 1 from public.workspace_members m where m.workspace_id=policies.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy policies_delete on public.policies for delete to authenticated using (exists(select 1 from public.workspace_members m where m.workspace_id=policies.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy if exists incidents_workspace_write on public.incidents;
create policy incidents_insert on public.incidents for insert to authenticated with check (exists(select 1 from public.workspace_members m where m.workspace_id=incidents.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy incidents_update on public.incidents for update to authenticated using (exists(select 1 from public.workspace_members m where m.workspace_id=incidents.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst'))) with check (exists(select 1 from public.workspace_members m where m.workspace_id=incidents.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));

drop policy if exists recovery_plans_workspace_write on public.recovery_plans;
create policy recovery_plans_insert on public.recovery_plans for insert to authenticated with check (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_plans.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));
create policy recovery_plans_update on public.recovery_plans for update to authenticated using (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_plans.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst'))) with check (exists(select 1 from public.workspace_members m where m.workspace_id=recovery_plans.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));

