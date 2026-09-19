revoke execute on function public.append_security_event from anon;
revoke execute on function public.assess_incident_restart from anon;
revoke execute on function public.reset_laboratory from anon;
revoke insert, update, delete on table public.security_events from anon, authenticated;
grant select on table public.security_events to authenticated;

