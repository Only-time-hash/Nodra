revoke execute on function public.apply_laboratory_remediation_state(uuid,text) from authenticated;
revoke execute on function public.run_laboratory_remediation(uuid,text,text) from authenticated;
revoke execute on function public.sync_recovery_steps_for_incident(uuid,text) from authenticated;
grant execute on function public.run_laboratory_remediation_atomic(uuid,text,text) to authenticated;

