create index gateway_request_nonces_workspace_agent_idx
  on public.gateway_request_nonces(workspace_id, agent_id);
