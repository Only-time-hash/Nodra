# Customer onboarding

Nodra's customer onboarding uses per-agent integration credentials. Do not use a deployment-wide signing secret in customer applications.

1. Sign in and create or select a Nodra workspace.
2. Register the customer agent through the onboarding UI or `POST /api/integrations/agents`.
3. Define explicit authority scope for that agent.
4. An owner or admin issues an integration credential through the onboarding UI or `POST /api/integrations/credentials`.
5. Copy the plaintext credential when it is issued. Nodra returns it once; store it only in the customer's trusted server runtime.
6. Configure the Nodra base URL and credential in that runtime.
7. Use the repository JavaScript/TypeScript SDK, Python SDK, or the signed REST protocol. Public registry packages must not be advertised until publication is verified.
8. Call authorization before consequential execution and record intent/result evidence.
9. Use **Test connection** after the runtime sends a signed request. `connected=true` requires an active credential, credential use and gateway evidence within the last five minutes, configured authority, and a healthy agent.
10. Anything outside explicit authority requires approval; unhealthy agents are denied.

## Credential lifecycle

Integration credentials are scoped to a workspace and agent. Owners/admins can issue, rotate, and revoke them. The stored record contains a hash/prefix and metadata; the plaintext secret is returned only when a credential is issued or rotated.

Never commit a Nodra integration credential to Git, place it in browser code, or share it between unrelated agents.
