# Nodra Private Beta Tracker

Updated: 2026-09-26

This tracker is the source of truth for the eight blockers required before Nodra is offered to external AI companies as a private beta.

## 1. Public JavaScript / TypeScript SDK — BUILDING

Implemented:
- Nodra client with signed HMAC authorization.
- Protected-agent helper.
- Event recording.
- Human-approved execution.
- MCP, OpenAI, LangChain, CrewAI, REST and generic tool adapters.
- Publishable package layout with compiled JavaScript and bundled TypeScript declarations.
- Explicit Node package exports.
- Structured `NodraError`.
- Request timeout and bounded retry handling.
- Retry disabled for one-time approval-token execution.
- Public README, license, engine declaration and package metadata.
- CI build and `npm pack --dry-run` verification added.
- Collision-safe npm package name: `nodra-agent-sdk`.

Remaining:
- CI must pass with the new publish bundle.
- Run package install test from a clean external project.
- Publish the first npm beta release after npm publisher credentials are configured.
- Add automatic approval continuation after blocker #4 is built.

## 2. Public Python SDK — BUILDING

Implemented:
- Public `nodra-agent-sdk` distribution with `nodra` import package.
- HMAC-signed authorization.
- Protected-agent helper.
- Event intent/result recording.
- Human-approved execution parity.
- Structured `NodraError` with code/status/request ID/retryability.
- Bounded timeout and retry handling.
- Automatic retries disabled for one-time approved execution.
- Dependency-light standard-library HTTP client.
- Complete package metadata, README and Apache-2.0 license.
- Wheel + sdist build added to CI.
- Clean virtual-environment wheel install/import verification added to CI.
- Expanded Python SDK signing/error/approval tests.

Remaining:
- CI must pass with the Python distribution checks.
- Publish the first PyPI beta after Trusted Publishing is configured.
- Add automatic approval continuation after blocker #4 is built.

## 3. Stable v1 API + Developer Documentation — REMAINING

Remaining:
- Freeze public v1 routes and schemas.
- Stable error-code catalog.
- OpenAPI specification.
- Backward-compatibility/deprecation rules.
- API request IDs/tracing.
- Complete external integration documentation.

## 4. Automatic Approval Continuation — REMAINING

Existing foundation:
- `require-approval` decisions.
- Reviewer Approve/Deny.
- Rationale.
- One-time five-minute execution token.
- `executeApproved()` consumption and evidence.

Remaining:
- Secure runtime wait/poll/callback mechanism.
- Automatic token delivery to waiting protected runtime.
- Resume execution without manual copying.

## 5. Strong Production Policy Engine — REMAINING

Existing foundation:
- Authority scopes.
- Allow / deny / require-approval.
- High-impact review preference.
- Real policy records.

Remaining:
- Conditional rules.
- Resource constraints.
- Amount/value limits.
- Environment/time-window conditions.
- Delegation/expiry.
- Policy priorities and conflict handling.
- Policy simulator/debugger.

## 6. Real Production Containment + Recovery — REMAINING

Existing foundation:
- Incidents.
- Agent pause/restricted state.
- Containment actions.
- Recovery plans.
- Remediation evidence.
- Safe-restart state.

Remaining:
- Customer-runtime adapters.
- Credential rotation adapter.
- Job cancellation adapter.
- Tool/API isolation adapter.
- State/memory cleanup adapter.
- Verified production safe restart.

## 7. Security + End-to-End Test Gate — REMAINING

Existing foundation:
- Unit tests.
- Migration verification.
- Database isolation tests.
- CI build/typecheck.
- Replay defenses and signed requests.

Remaining:
- Full external E2E:
  authorize allow -> deny -> approval -> execute -> incident -> containment -> recovery.
- Cross-workspace attack tests.
- Token replay/expiry tests.
- Credential-revocation tests.
- Load/latency benchmarks.
- Security-definer RPC audit.

## 8. External Agent Integration Proof — REMAINING

Remaining:
- Create a completely separate sample AI-agent repository.
- Install Nodra as an external dependency.
- Connect without importing Nodra internals.
- Prove allow / deny / approval / evidence.
- Prove containment and recovery.
- Document a 10-minute quickstart.

## Private Beta Exit Condition

Nodra is private-beta ready when all eight blockers above are marked DONE and an external agent can integrate without access to the Nodra monorepo.
