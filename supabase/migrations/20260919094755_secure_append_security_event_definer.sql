
alter function public.append_security_event(uuid,uuid,uuid,text,text,uuid,public.security_decision,uuid,jsonb,timestamptz)
security definer;

alter function public.append_security_event(uuid,uuid,uuid,text,text,uuid,public.security_decision,uuid,jsonb,timestamptz)
set search_path = public, extensions;

revoke all on function public.append_security_event(uuid,uuid,uuid,text,text,uuid,public.security_decision,uuid,jsonb,timestamptz) from public, anon;
grant execute on function public.append_security_event(uuid,uuid,uuid,text,text,uuid,public.security_decision,uuid,jsonb,timestamptz) to authenticated;

