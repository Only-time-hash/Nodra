
create or replace function public.create_workspace(p_name text, p_slug text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  insert into public.workspaces(owner_id,name,slug)
  values ((select auth.uid()),p_name,p_slug)
  returning id into v_id;
  insert into public.workspace_members(workspace_id,user_id,role)
  values (v_id,(select auth.uid()),'owner');
  return v_id;
end;
$$;

revoke all on function public.create_workspace(text,text) from public;
grant execute on function public.create_workspace(text,text) to authenticated;

drop policy if exists agents_workspace_access on public.agents;
create policy agents_workspace_read on public.agents for select to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=agents.workspace_id and m.user_id=(select auth.uid())));
create policy agents_workspace_write on public.agents for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=agents.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=agents.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy if exists policies_workspace_access on public.policies;
create policy policies_workspace_read on public.policies for select to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=policies.workspace_id and m.user_id=(select auth.uid())));
create policy policies_workspace_write on public.policies for all to authenticated
using (exists(select 1 from public.workspace_members m where m.workspace_id=policies.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')))
with check (exists(select 1 from public.workspace_members m where m.workspace_id=policies.workspace_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

