-- Signed runtime gateway RPCs are invoked by Nodra server routes through
-- the Supabase publishable-key anonymous role. Signed-in browser users do not
-- need direct EXECUTE access to these credential-bound functions.

revoke execute on function public.append_high_impact_review_override(text,uuid,text,text) from authenticated;
revoke execute on function public.apply_integration_policy_override(text,uuid,text,text,jsonb) from authenticated;
revoke execute on function public.authorize_integration_gateway(text,text,text,timestamptz,timestamptz,text,text) from authenticated;
revoke execute on function public.claim_integration_approval_token(text,text,uuid,text,text,text,timestamptz) from authenticated;
revoke execute on function public.execute_approved_integration_action(text,text,text,timestamptz,timestamptz,uuid,text,text,text) from authenticated;
revoke execute on function public.get_integration_approval_status(text,text,uuid,text,text) from authenticated;
revoke execute on function public.integration_api_access_allowed(text) from authenticated;
revoke execute on function public.integration_high_impact_review_enabled(text,text) from authenticated;
revoke execute on function public.record_integration_gateway_event(text,text,text,timestamptz,timestamptz,text,text,text,text,text,boolean,text,text,text,uuid,uuid,timestamptz) from authenticated;

grant execute on function public.append_high_impact_review_override(text,uuid,text,text) to anon;
grant execute on function public.apply_integration_policy_override(text,uuid,text,text,jsonb) to anon;
grant execute on function public.authorize_integration_gateway(text,text,text,timestamptz,timestamptz,text,text) to anon;
grant execute on function public.claim_integration_approval_token(text,text,uuid,text,text,text,timestamptz) to anon;
grant execute on function public.execute_approved_integration_action(text,text,text,timestamptz,timestamptz,uuid,text,text,text) to anon;
grant execute on function public.get_integration_approval_status(text,text,uuid,text,text) to anon;
grant execute on function public.integration_api_access_allowed(text) to anon;
grant execute on function public.integration_high_impact_review_enabled(text,text) to anon;
grant execute on function public.record_integration_gateway_event(text,text,text,timestamptz,timestamptz,text,text,text,text,text,boolean,text,text,text,uuid,uuid,timestamptz) to anon;
