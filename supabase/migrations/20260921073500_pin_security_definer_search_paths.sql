-- Harden authenticated SECURITY DEFINER RPCs by pinning search_path.
-- All relation references in these functions are schema-qualified.
alter function public.append_security_event(uuid,uuid,uuid,text,text,uuid,public.security_decision,uuid,jsonb,timestamptz)
  set search_path = '';
alter function public.consume_gateway_rate_limit(uuid,uuid)
  set search_path = '';
alter function public.consume_protected_agent_rate_limit(uuid)
  set search_path = '';
alter function public.record_gateway_intent(uuid,uuid,uuid,text,jsonb)
  set search_path = '';
alter function public.reset_laboratory(uuid)
  set search_path = '';
alter function public.run_laboratory_remediation_atomic(uuid,text,text)
  set search_path = '';

revoke execute on function public.append_security_event(uuid,uuid,uuid,text,text,uuid,public.security_decision,uuid,jsonb,timestamptz) from public, anon;
revoke execute on function public.consume_gateway_rate_limit(uuid,uuid) from public, anon;
revoke execute on function public.consume_protected_agent_rate_limit(uuid) from public, anon;
revoke execute on function public.record_gateway_intent(uuid,uuid,uuid,text,jsonb) from public, anon;
revoke execute on function public.reset_laboratory(uuid) from public, anon;
revoke execute on function public.run_laboratory_remediation_atomic(uuid,text,text) from public, anon;
