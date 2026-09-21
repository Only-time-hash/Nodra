-- Expose only the role-checked atomic remediation entrypoint to authenticated application users.
revoke execute on function public.run_laboratory_remediation_atomic(uuid,text,text) from public,anon;
grant execute on function public.run_laboratory_remediation_atomic(uuid,text,text) to authenticated;

-- Internal helpers remain service-role only.
revoke execute on function public.run_laboratory_remediation(uuid,text,text) from public,anon,authenticated;
revoke execute on function public.apply_laboratory_remediation_state(uuid,text) from public,anon,authenticated;
revoke execute on function public.sync_recovery_steps_for_incident(uuid,text) from public,anon,authenticated;
