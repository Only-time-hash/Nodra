drop policy if exists agents_update on public.agents;
create policy agents_update on public.agents for update to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=agents.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=agents.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin','analyst')));

