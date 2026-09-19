revoke execute on function public.run_laboratory_remediation(uuid,text,text) from public;
revoke execute on function public.run_laboratory_remediation(uuid,text,text) from anon;
grant execute on function public.run_laboratory_remediation(uuid,text,text) to authenticated;

