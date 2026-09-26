# Nodra Private Beta Tracker

Updated: 2026-09-26

This is the source of truth for the eight blockers required before Nodra is offered to external AI companies as a private beta.

## 1. Public JavaScript / TypeScript SDK — BUILDING

Implemented:
- Publishable `nodra-agent-sdk` package layout.
- Compiled JavaScript and TypeScript declarations.
- Explicit package exports.
- HMAC-signed v1 authorization.
- Protected-agent helper.
- Intent/result evidence recording.
- One-time approved execution.
- Automatic approval wait/claim/resume.
- Structured `NodraError`.
- Bounded timeout/retry handling.
- One-time approved execution is deliberately not automatically retried.
- MCP, OpenAI, LangChain, CrewAI, REST and generic tool adapters.
- Conditional authorization context for amount/environment/metadata.
- External clean-install CI verification.
- Isolated external-consumer fixture.
- Trusted npm publishing workflow with OIDC/provenance metadata.
- Repeatable SDK/local-gateway latency benchmark.

Remaining:
- Latest CI must be fully green.
- Configure npm Trusted Publishing for the repository/environment.
- Publish the first npm beta release.
- Run the published package against a real external Nodra workspace.

## 2. Public Python SDK — BUILDING

Implemented:
- Public `nodra-agent-sdk` distribution with `nodra` import package.
- HMAC-signed v1 authorization.
- Protected-agent helper.
- Intent/result evidence recording.
- Automatic approval wait/claim/resume.
- Structured `NodraError`.
- Bounded timeout/retry handling.
- Approved execution is not automatically retried.
- Conditional policy context support.
- Wheel + sdist build.
- Clean virtual-environment wheel install/import verification.
- Trusted PyPI publishing workflow.

Remaining:
- Latest CI must be fully green.
- Configure PyPI Trusted Publishing.
- Publish first PyPI beta release.
- Run the published package against a real external Nodra workspace.

## 3. Stable v1 API + Developer Documentation — DONE FOR BETA

Implemented:
- `/api/v1/authorize`.
- `/api/v1/events`.
- `/api/v1/execute-approved`.
- `/api/v1/approval-status`.
- `/api/v1/approval-claim`.
- `/api/v1/health`.
- Stable v1 version header and request IDs.
- Legacy gateway compatibility.
- OpenAPI 3.1 contract.
- Public web copy of `openapi.yaml`.
- CI contract validation and drift prevention.
- v1 API/deprecation documentation.
- JavaScript external quickstart.
- Python external quickstart.

Remaining:
- Latest CI/OpenAPI validation must be green.
- Add framework-specific quickstarts where needed for beta partners.
- Freeze any additional management endpoints required by pilot customers.

## 4. Automatic Approval Continuation — DONE

Implemented:
- `require-approval` decision.
- Human Approve/Deny with rationale.
- Runtime approval polling.
- Runtime-generated one-time execution token.
- Only the token hash is stored.
- Exact agent/resource/action/authorization-event binding.
- Idempotent claim for the same token.
- Different-token replacement blocked.
- Expired/overlong claim lifetimes rejected.
- Malformed token hashes rejected.
- Automatic SDK resume through `executeApproved()`.
- Human reviewers no longer copy execution secrets.
- Replay/consumption protection tested against the live schema and CI test added.

## 5. Strong Production Policy Engine — DONE FOR BETA

Implemented:
- Registered authority remains the hard maximum boundary.
- Default restrictive behavior.
- Allow / deny / require-approval.
- Explicit deny precedence.
- Policy priorities.
- Agent-specific and workspace-wide rules.
- Resource targeting.
- Wildcard action matching.
- Amount/value conditions.
- Environment conditions.
- UTC time windows.
- Day-of-week conditions.
- Metadata equality conditions.
- Starts-at / expires-at.
- High-impact review.
- Runtime policy override evidence.
- Shared database evaluator for runtime and simulation.
- Policy simulator API.
- Policy simulator console.
- Policy management validation.

Remaining:
- Explicit delegated-authority model with bounded delegation and expiry.
- More policy-authoring UI for complex conditions.
- Pilot-driven policy templates.

## 6. Real Production Containment + Recovery — DONE FOR CORE BETA

Implemented:
- Evidence-derived containment scope.
- Atomic customer-incident containment.
- Origin-agent quarantine.
- Descendant authority restriction.
- Origin credential revocation.
- Recovery plan with four explicit evidence checks.
- Real credential rotation with plaintext shown once.
- Actual rotation timestamp used for safe-restart ordering.
- Pending Nodra work cancellation.
- Operator evidence for origin remediation.
- Memory/state review evidence.
- Recovery action/evidence ledger.
- Owner/admin safe-restart approval.
- Fresh post-containment credential requirement.
- Only incident-affected agents restored.
- Safe-restart evidence event.
- Recovery console wired to real operations.
- Full live-schema containment -> recovery -> safe-restart E2E passes.
- The same lifecycle is now a CI database test.

Remaining:
- Generic adapters for external customer queues/tools/runtimes beyond Nodra-controlled enforcement.
- Pilot-specific adapters based on the first external integration.

## 7. Security + End-to-End Test Gate — DONE

Implemented:
- Signed request verification.
- Body, timestamp and nonce tamper rejection.
- Expired/future signature rejection.
- Replay protection.
- Cross-workspace isolation.
- Fail-closed behavior.
- Quarantined-agent enforcement.
- Policy explicit-deny precedence tests.
- Approval denial tests.
- Approval claim replay/expiry/malformed-hash tests.
- One-time execution consumption tests.
- Credential revocation as part of recovery E2E.
- Safe-restart bypass checks.
- Transactional customer containment/recovery E2E.
- Database isolation suite.
- Internal rate-limit tables hardened with explicit deny policies.
- Missing approval/credential FK indexes added.
- Runtime gateway RPC grants narrowed to the anonymous publishable-key role.
- Repeatable SDK/local-gateway latency benchmark in CI.

Completed gate:
- Nodra CI passes.
- Nodra Security Engine passes.
- Nodra Quality Gate passes.
- External packed-SDK consumer passes.
- Local isolated Supabase recovery E2E passes.
- Approval replay/expiry security test passes.
- SDK/local-gateway benchmark passes with measured p95 below the CI threshold.

Post-beta hardening:
- Real deployed-gateway load benchmark using a pilot workspace.
- Periodic review of the intentionally allowlisted anonymous SECURITY DEFINER gateway RPCs.

## 8. External Agent Integration Proof — BUILDING

Implemented:
- External-consumer fixture imports only `nodra-agent-sdk`.
- CI copies it into a clean temporary project.
- CI installs only the packed SDK artifact.
- No internal Nodra source imports.
- Proves external authorize -> require approval -> approval claim -> approved execution -> result evidence.

Remaining:
- Publish beta SDK.
- Run the same consumer against a real Nodra workspace/credential rather than the CI mock contract.
- Create a truly separate sample repository once the published SDK exists.
- Prove real containment/recovery with that external agent.
- Turn the result into the 10-minute customer onboarding proof.

## Private Beta Exit Condition

Nodra is private-beta ready when:
1. all CI/security/database gates are green,
2. JavaScript and Python beta SDKs are published,
3. a truly external agent using only the published SDK completes allow/deny/approval/evidence,
4. that external agent can be contained and recovered through the real Nodra control plane.


## Latest Green Verification

Latest verified green engineering commit: `4c52140e57f8e80ebc8664254de0c14dbdc5c2ff`.

Verified gates:
- Nodra CI: PASS
- Nodra Security Engine: PASS
- Nodra Quality Gate: PASS

Release/deployment note:
- The Vercel production alias is still serving an older commit.
- The connected direct Vercel deploy action is currently unavailable at runtime, so deployment has not been falsely marked complete.
