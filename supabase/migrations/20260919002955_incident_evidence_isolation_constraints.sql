create or replace function public.enforce_remediation_incident_scope() returns trigger language plpgsql set search_path=public as $$
begin
 if new.adapter_action_id is not null and not exists(select 1 from remediation_actions a where a.id=new.adapter_action_id and a.workspace_id=new.workspace_id and a.incident_id=new.incident_id) then raise exception 'remediation_evidence_incident_mismatch'; end if;
 if not exists(select 1 from incidents i where i.id=new.incident_id and i.workspace_id=new.workspace_id) then raise exception 'incident_workspace_mismatch'; end if;
 return new;
end $$;
drop trigger if exists remediation_evidence_incident_scope on public.remediation_evidence;
create trigger remediation_evidence_incident_scope before insert or update on public.remediation_evidence for each row execute function public.enforce_remediation_incident_scope();

