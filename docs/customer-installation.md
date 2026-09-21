# Install Nodra in a customer runtime

## 1. Register the agent
Open **Connect your first agent** in Nodra, create a stable agent ID, and configure only the authority the agent needs.

## 2. Create a credential
Generate the agent credential once. Store `NODRA_CREDENTIAL` in a server-side secret manager. Never embed it in browser/mobile bundles, logs, source control, screenshots, or client configuration.

## 3. Choose a runtime
### Node
Use `@nodra/sdk` from a trusted server runtime and protect sensitive tool calls with `protectTool` or a framework guard.

### Python
Use the Nodra Python client from the agent backend.

### Gateway
Build with `deploy/Dockerfile.gateway` or use `deploy/docker-compose.gateway.yml`. Set `NODRA_BASE_URL` and `NODRA_CREDENTIAL`.

## 4. Enforcement rule
A protected action executes only when Nodra returns `allow`. `deny`, `require-approval`, network errors, invalid signatures, replay failures, or unavailable security checks must not be interpreted as permission.

## 5. Verify
Send a signed authorization/event, then use the onboarding **Test connection** action. Protection becomes active only after Nodra sees credential use, protected runtime evidence, configured authority, and a healthy agent.

## 6. Rotate/revoke
Rotate a credential if exposure is suspected. Revoke credentials that are no longer used. Restart the customer runtime with the replacement secret.

## Production checklist
- HTTPS Nodra endpoint
- credential only in server secret storage
- least-privilege authority scope
- Nodra authorization before sensitive execution
- evidence recording after execution
- no bypass path around the guard
- health/restart policy for the Gateway
- credential rotation procedure tested
