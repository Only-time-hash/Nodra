revoke execute on function public.assess_incident_restart(uuid) from public, anon, authenticated;
grant execute on function public.assess_incident_restart(uuid) to service_role;
