# V0.1 Release Verification

A release is not considered verified until every required check below has evidence.

## Automated
- [x] npm dependencies install from committed lockfile with npm ci.
- [x] Runtime, policy, containment, recovery and laboratory tests pass.
- [x] TypeScript typecheck passes.
- [x] Next.js production build passes.
- [x] Five-agent selective containment acceptance test passes.
- [x] Recovery refuses restart without every system check and human approval.
- [x] Gateway signatures reject body, timestamp and nonce tampering, cross-agent and cross-workspace identity use, malformed signature inputs, and expired requests.

## Database security
- [x] Two distinct authenticated identities cannot cross workspace boundaries (re-verified against production schema with transactional cross-workspace read and privileged reset attacks).
- [x] Anonymous execution denied for event recorder, restart assessment and laboratory reset.
- [x] Direct authenticated security-event insert/update denied.
- [x] Direct authenticated remediation-evidence insert denied.
- [x] Direct authenticated remediation-action update denied.
- [x] Cross-incident remediation evidence is rejected by the transactional database security suite.
- [x] Signed gateway nonces are single-use and reject database-level replay.
- [x] Cross-workspace/cross-agent gateway nonce binding is rejected against the production schema using authenticated workspace-A context with a workspace-B agent; the assurance transaction was rolled back.
- [x] Security Advisor reviewed; remaining SECURITY DEFINER warnings are documented and intentional because each function performs its own authenticated workspace/role/object-scope checks. Do not revoke EXECUTE without replacing the application RPC path.

## Adversarial assurance matrix
- [x] Goal/prompt hijacking cannot expand the Research agent's allowed browser:read / notes:write authority. Dedicated adversarial regression tests preserve the goal as untrusted data while the executable allowlist remains browser:read / notes:write; both CI workflows passed at `e7d1c9770fb18111d7bbdbd8a9f7b6d534980a8b`.
- [x] Tool arguments are schema-validated before protected adapter execution. Regression tests reject unauthorized resource/action pairs, malformed/non-object input, excessive keys, oversized UTF-8 input, malformed JSON, and oversized model output; both CI workflows passed at `e7d1c9770fb18111d7bbdbd8a9f7b6d534980a8b`.
- [x] Unknown, paused, offline, or unresolved agent state fails closed at the protected route; production bypass testing remains part of final end-to-end verification.
- [x] Signed gateway request tampering plus cross-agent/cross-workspace identity substitution are rejected by the signing tests; database replay and cross-workspace/cross-agent nonce binding are separately rejected against the production schema.
- [x] Gateway replay is rejected after nonce consumption.
- [x] Cross-workspace data access is rejected by RLS verification.
- [x] Incident evidence remains isolated to its incident.
- [x] Recovery cannot complete without remediation evidence and authorized human approval.
- [x] Provider failure, timeout, malformed model JSON, and unavailable recorder all fail closed before unauthorized tool execution. Timeout/malformed-output evidence passed at `670202faa8585f45198a8fe1c38782bda4f88f75`; Flight Recorder HTTP/network failure evidence passed at `708e79b7b1d164dfcafefc4bfa8d85749f24a93f`; Gemini HTTP 503 and OpenAI HTTP 429 provider-failure regressions passed in both CI workflows at `26b1f85b2ce0e9ae7f1358e4d1e8f249a213e451`.
- [ ] Production model credentials use the provider's current restricted/auth-key mechanism and remain server-side. Source scan found no committed `GEMINI_API_KEY`, `OPENAI_API_KEY`, `NODRA_GATEWAY_SIGNING_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY`; deployment-secret presence/restrictions and rotation policy still require production-side verification.
- [ ] Release candidate receives an independent verification pass against the assurance invariants in docs/v0.1.md.

## Production
- [x] GitHub OAuth completes callback and onboarding.
- [ ] Gemini model call succeeds through the protected runtime path.
- [x] Incident → containment → investigation → remediation → approval → restart succeeds.
- [x] Support remains healthy in the five-agent scenario.
- [ ] Desktop, tablet and mobile layouts are visually tested.
- [x] Stable production alias serves the verified commit.

Do not mark V0.1 released while a required unchecked item remains.
