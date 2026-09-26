# Runtime RPC trust boundary

Nodra's browser console and Nodra's signed agent runtime use different Supabase roles.

## Browser console

Authenticated human users use the `authenticated` role and are constrained by workspace RLS plus role-aware management RPCs.

The browser role is intentionally **not** allowed to execute the credential-gateway RPCs below.

## Signed runtime gateway

Nodra's server-side gateway routes create a Supabase client with the publishable key and no user session. That client uses the `anon` database role.

Before calling a runtime RPC, the route verifies the Nodra credential/HMAC request. The RPC then validates the credential hash against an active workspace-bound integration credential.

The anonymous `SECURITY DEFINER` allowlist is intentionally limited to:

- `authorize_integration_gateway` — authority decision + nonce/rate-limit state.
- `record_integration_gateway_event` — append credential-bound runtime evidence.
- `integration_api_access_allowed` — enforce workspace API-access setting.
- `integration_high_impact_review_enabled` — read the credential workspace's high-impact review setting.
- `append_high_impact_review_override` — append a linked require-approval override to an existing matching authorization event.
- `apply_integration_policy_override` — apply a linked deny/review policy override to an existing matching authorization event.
- `get_integration_approval_status` — return approval status only for the credential's exact agent/action/resource/event tuple.
- `claim_integration_approval_token` — bind a runtime-generated one-time token hash to an approved exact action.
- `execute_approved_integration_action` — atomically consume the approval token and append approved-execution evidence.

## Security invariants

CI fails if:

1. any additional anonymous `SECURITY DEFINER` function appears in `public`;
2. any allowlisted runtime RPC is granted to PostgreSQL `PUBLIC`;
3. any allowlisted runtime RPC is executable by the signed-in browser role;
4. an expected allowlisted runtime RPC loses the anonymous runtime grant.

Runtime RPCs use credential hashes as credential-equivalent lookup material. They must never return stored secret hashes or accept a workspace/agent identity that does not match the credential.

Longer term, an enterprise private deployment may move this surface behind a dedicated private Postgres/API role. The private-beta architecture keeps the surface narrow and continuously tested while avoiding a long-lived service-role credential in ordinary runtime routes.
