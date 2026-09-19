revoke update on table public.remediation_actions from authenticated;
grant select, insert on table public.remediation_actions to authenticated;
revoke insert on table public.remediation_evidence from authenticated;
grant select on table public.remediation_evidence to authenticated;

