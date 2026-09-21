# Customer onboarding

1. Sign in and create/select a Nodra workspace.
2. An owner or admin registers a customer agent through POST /api/integrations/agents.
3. Keep NODRA_GATEWAY_SIGNING_SECRET server-side and configure the workspace ID and Nodra base URL.
4. Install @nodra/sdk and call agent.authorize before sensitive execution.
5. Record intent/result evidence.
6. POST /api/integrations/test with the agent external ID. connected=true means Nodra has received runtime evidence from that registered identity.
7. Configure explicit authority scope. Anything outside explicit authority requires approval; unhealthy agents are denied.

Credential self-service provisioning is intentionally not faked: the current gateway derives agent keys from the deployment master secret. Per-customer secret issuance/rotation needs a dedicated encrypted credential store before it is exposed in onboarding UI.
