create table public.laboratory_security_state (
 workspace_id uuid primary key references public.workspaces(id) on delete cascade,
 origin_patched boolean not null default false,
 credential_generation integer not null default 1,
 memory_clean boolean not null default false,
 pending_jobs integer not null default 2,
 updated_at timestamptz not null default now()
);
alter table public.laboratory_security_state enable row level security;
create policy laboratory_state_read on public.laboratory_security_state for select to authenticated using(exists(select 1 from public.workspace_members m where m.workspace_id=laboratory_security_state.workspace_id and m.user_id=(select auth.uid())));
revoke all on public.laboratory_security_state from anon,authenticated;
grant select on public.laboratory_security_state to authenticated;

create or replace function public.apply_laboratory_remediation_state(p_workspace_id uuid,p_action_type text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
 if not exists(select 1 from workspace_members where workspace_id=p_workspace_id and user_id=auth.uid() and role in ('owner','admin','analyst')) then raise exception 'not_authorized'; end if;
 insert into laboratory_security_state(workspace_id) values(p_workspace_id) on conflict do nothing;
 case p_action_type
  when 'patch_origin' then update laboratory_security_state set origin_patched=true,updated_at=now() where workspace_id=p_workspace_id;
  when 'rotate_credentials' then update laboratory_security_state set credential_generation=credential_generation+1,updated_at=now() where workspace_id=p_workspace_id;
  when 'review_memory' then update laboratory_security_state set memory_clean=true,updated_at=now() where workspace_id=p_workspace_id;
  when 'cancel_pending_jobs' then update laboratory_security_state set pending_jobs=0,updated_at=now() where workspace_id=p_workspace_id;
  else raise exception 'invalid_action_type';
 end case;
 select to_jsonb(s) into v from laboratory_security_state s where workspace_id=p_workspace_id;
 return v;
end $$;
revoke all on function public.apply_laboratory_remediation_state(uuid,text) from public,anon;
grant execute on function public.apply_laboratory_remediation_state(uuid,text) to authenticated;

