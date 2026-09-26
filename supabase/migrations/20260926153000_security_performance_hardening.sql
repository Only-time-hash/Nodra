create index if not exists approval_decisions_security_event_idx
  on public.approval_decisions(security_event_id);

create index if not exists integration_credentials_agent_idx
  on public.integration_credentials(agent_id);

create index if not exists integration_credentials_rotated_from_idx
  on public.integration_credentials(rotated_from)
  where rotated_from is not null;

drop policy if exists gateway_rate_limits_no_direct_client_access
  on public.gateway_rate_limits;
create policy gateway_rate_limits_no_direct_client_access
  on public.gateway_rate_limits
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists protected_agent_rate_limits_no_direct_client_access
  on public.protected_agent_rate_limits;
create policy protected_agent_rate_limits_no_direct_client_access
  on public.protected_agent_rate_limits
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists workspace_settings_write on public.workspace_settings;

drop policy if exists workspace_settings_insert on public.workspace_settings;
create policy workspace_settings_insert
  on public.workspace_settings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.workspace_members m
      where m.workspace_id=workspace_settings.workspace_id
        and m.user_id=(select auth.uid())
        and m.role in ('owner','admin')
    )
  );

drop policy if exists workspace_settings_update on public.workspace_settings;
create policy workspace_settings_update
  on public.workspace_settings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members m
      where m.workspace_id=workspace_settings.workspace_id
        and m.user_id=(select auth.uid())
        and m.role in ('owner','admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members m
      where m.workspace_id=workspace_settings.workspace_id
        and m.user_id=(select auth.uid())
        and m.role in ('owner','admin')
    )
  );

drop policy if exists workspace_settings_delete on public.workspace_settings;
create policy workspace_settings_delete
  on public.workspace_settings
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members m
      where m.workspace_id=workspace_settings.workspace_id
        and m.user_id=(select auth.uid())
        and m.role='owner'
    )
  );
