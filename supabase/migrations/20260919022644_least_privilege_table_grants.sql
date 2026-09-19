do $$
declare t text;
begin
 foreach t in array array['workspaces','workspace_members','agents','resources','policies','incidents','security_events','causal_edges','incident_affected_entities','containment_actions','recovery_plans','recovery_steps','credential_refs','remediation_evidence','remediation_actions','gateway_outbox','laboratory_security_state']
 loop
   execute format('revoke all privileges on table public.%I from anon',t);
   execute format('revoke truncate, references, trigger on table public.%I from authenticated',t);
 end loop;
end $$;

