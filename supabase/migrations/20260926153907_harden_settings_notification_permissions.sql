revoke all on function public.enqueue_nodra_notification() from public, anon, authenticated;
revoke all on function public.enqueue_nodra_incident_notification() from public, anon, authenticated;

drop policy if exists notification_outbox_no_direct_access on public.notification_outbox;
create policy notification_outbox_no_direct_access
on public.notification_outbox
for all to authenticated
using (false)
with check (false);

create index if not exists notification_destinations_created_by_idx
  on public.notification_destinations(created_by);

create index if not exists notification_outbox_workspace_idx
  on public.notification_outbox(workspace_id);

drop function if exists public.deliver_nodra_notifications();

drop extension pg_net;
create schema if not exists extensions;
create extension pg_net with schema extensions;

create or replace function public.deliver_nodra_notifications()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row public.notification_outbox%rowtype;
  v_dest record;
  v_delivered integer := 0;
begin
  for v_row in
    select *
    from public.notification_outbox
    where delivered_at is null and attempt_count < 6
    order by created_at
    limit 50
    for update skip locked
  loop
    begin
      for v_dest in
        select nd.id, nd.kind, ds.decrypted_secret as endpoint
        from public.notification_destinations nd
        join vault.decrypted_secrets ds on ds.id=nd.vault_secret_id
        where nd.workspace_id=v_row.workspace_id
          and nd.enabled
          and v_row.event_kind = any(nd.event_types)
      loop
        perform net.http_post(
          url := v_dest.endpoint,
          body := jsonb_build_object(
            'text',
            '[Nodra] ' || upper(v_row.event_kind) || ' security event',
            'event',
            v_row.payload
          ),
          headers := '{"Content-Type":"application/json","User-Agent":"Nodra-Security-Notifier/1.0"}'::jsonb
        );
      end loop;

      update public.notification_outbox
      set delivered_at=clock_timestamp(),
          attempt_count=attempt_count+1,
          last_error=null
      where id=v_row.id;

      v_delivered := v_delivered + 1;
    exception when others then
      update public.notification_outbox
      set attempt_count=attempt_count+1,
          last_error=left(sqlerrm,500)
      where id=v_row.id;
    end;
  end loop;

  return v_delivered;
end;
$$;

revoke all on function public.deliver_nodra_notifications() from public,anon,authenticated;
