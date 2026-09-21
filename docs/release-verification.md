# V0.1 Release Verification

A release is not considered verified until every required check below has evidence.

## Automated
- [x] npm dependencies install from committed lockfile with npm ci.
- [x] Runtime, policy, containment, recovery and laboratory tests pass.
- [x] TypeScript typecheck passes.
- [x] Next.js production build passes.
- [x] Release CI measures test coverage with Node's built-in coverage instrumentation; coverage, unit/acceptance tests, migration integrity, typecheck, and production build all passed together at `7915627baebe2afe2bc874f4926818169e831729`.
- [x] Protected-agent abuse guard is workspace-scoped and regression-tested; limiter exhaustion, workspace isolation, reset behavior, and invalid configuration passed both CI workflows at `cd64640ffffb04c53b19492e9b2a4575e52bff96`. This process-local layer is retained as the fast first layer; a fixed server-controlled PostgreSQL workspace quota now provides distributed enforcement before provider execution, with production attack evidence recorded below.
- [x] Flight Recorder ingestion has an independent workspace-scoped pressure ceiling so event flooding cannot consume the same budget as protected model/tool requests; both CI workflows passed at `d8f4663c9ff6c1d2ed89bfaf9bce2bd2a835345b`. Shared distributed enforcement remains required before this control is considered production-complete.
- [x] Baseline browser security headers compile and pass the full release/security workflows; CSP no longer permits `unsafe-eval` at `fa4e3970e84a1d47d6398af7a4abc64ebc85a1b5`. `unsafe-inline` remains a documented tightening target pending nonce/hash integration and live-browser verification.
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
- [x] Provider failure, timeout, malformed model JSON, and unavailable recorder all fail closed before unauthorized tool execution. Timeout/malformed-output evidence passed at `670202faa8585f45198a8fe1c38782bda4f88f75`; Flight Recorder HTTP/network failure evidence passed at `708e79b7b1d164dfcafefc4bfa8d85749f24a93f`, and runtime-level evidence that recorder intent failure prevents adapter invocation passed in both CI workflows at `47d3a923a06cecead26caf59b27fb3318313eea5`; Gemini HTTP 503 and OpenAI HTTP 429 provider-failure regressions passed in both CI workflows at `26b1f85b2ce0e9ae7f1358e4d1e8f249a213e451`. Fenced JSON provider responses are normalized before the same constrained schema/policy validation and passed both CI workflows at `acd8f3b4ff72b4efd7cff6bdfc801a8609c82b2a`. Capability-specific parameters are now independently bounded and validated (HTTPS-only browser reads, no embedded credentials or method expansion; bounded text-only note writes; bounded provider response bodies), with adversarial regression tests passing both CI workflows at `57554a3d75832eb525b78c788aa8a5484aa2d0c5`. Protected browser decisions additionally reject obvious localhost, private, link-local, metadata, multicast/reserved and local IPv6 targets; the adversarial regression suite passed both CI workflows at `86070d0fa40f085ef3832b2d0905ab35d3e21730`. This is a first-layer SSRF control; any future adapter that performs real network fetching must also resolve and classify DNS results and validate every redirect before connection. Oversized provider bodies now have explicit fail-closed regression coverage for both Gemini and OpenAI; both CI workflows passed at `f8c246f8aecd756a7e1e7f9fb934c2b0ae5abafa`. Post-execution Flight Recorder failure is now distinguished from pre-execution failure: a completed side effect raises an explicit non-retryable `PostExecutionObservationError` with the request ID, and the regression test proves the adapter executes exactly once; both CI workflows passed at `2f344930ba1692d72ca176213cf24a3fc3b9ee96`. The protected-agent HTTP boundary now preserves this state as `executed: true`, `retrySafe: false`, with the original request ID; after correcting the runtime import, both CI workflows passed at `e3adb75d9200dbede8506a57f35883d60c4e6fd3`. Recorder result handling was then separated from execution-error handling so a persistent recorder outage cannot mask completed execution or overwrite the original adapter failure; adversarial regressions for both cases passed in both CI workflows at `612d07075838678481116500c520eae8c49156cc`. The execution-state error is now exported through the supported `@nodra/runtime` package API rather than a deep source import; both Nodra CI and Nodra Security Engine passed at `7e0619443db7e76918c082da2f9818199cccb7e2`.
- [ ] Production model credentials use the provider's current restricted/auth-key mechanism and remain server-side. Source scan found no committed `GEMINI_API_KEY`, `OPENAI_API_KEY`, `NODRA_GATEWAY_SIGNING_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY`; deployment-secret presence/restrictions and rotation policy still require production-side verification.
- [x] Release candidate received a final assurance pass against the 12 invariants in docs/v0.1.md: fail-closed state handling, least authority, pre-execution containment, authenticated provenance, replay resistance, workspace isolation, evidence integrity, selective blast radius, evidence-gated recovery, model distrust, credential confinement at source boundaries, and release-evidence gating are represented by the automated/database/adversarial evidence in this checklist. The final live distributed gateway exhaustion check also verified request 240 succeeds and request 241 is denied. Production provider credential configuration and a successful live Gemini protected-runtime call remain separate release checks below and are not claimed by this assurance closure.

## Production
- [x] GitHub OAuth completes callback and onboarding.
- [ ] Gemini model call succeeds through the protected runtime path.
- [x] Incident → containment → investigation → remediation → approval → restart succeeds.
- [x] Support remains healthy in the five-agent scenario.
- [ ] Desktop, tablet and mobile layouts are visually tested.
- [x] Stable production alias serves the verified commit.

Do not mark V0.1 released while a required unchecked item remains.

- [x] IPv6 literal SSRF boundary regression: commit `ddde1daa3f84ce547a0340f1690de639aeecb477` rejects literal IPv6 browser targets including loopback/private cases; both Nodra CI run 35544228512 and Nodra Security Engine run 35544228525 passed. This is a first-layer parser boundary; a future real outbound adapter must also resolve DNS and revalidate redirect destinations before connection.

- [x] Distributed gateway recorder quota: commit `4588b8ab2fa88df5cf1804c2a48357d3118d63dc` passed Nodra CI run 35544644618 and Security Engine run 35544644628. Live database verification confirms `gateway_rate_limits` has RLS enabled with no authenticated direct SELECT/INSERT grants; `consume_gateway_rate_limit` is executable by authenticated callers and not anon, with membership and agent/workspace checks enforced inside the SECURITY DEFINER function.

- [x] Fixed distributed quota policy reproducibility: commit `604c87455c63ab67d4c9a94e9ab27d07a2e1938a` passed Nodra CI run 35544877859 and Security Engine run 35544877875. The repository now preserves the same two-argument, server-controlled quota upgrade path applied to production.
- [x] Latest hardened production deployment: production deployment `dpl_2DnkxUU69nCVaWrhb6EbPtBW92sK` is READY and targets production at commit `00196b8b00ae01a83b6aa90aa50bd96bc3569706` (`Disable evidence-only recovery bypass`). The stable `nodra-kappa.vercel.app` alias returned HTTP 200 after promotion, baseline security headers were present, and no runtime errors were observed in the immediate post-deployment verification window. Automatic Git-triggered deployment remains an operational follow-up, but the hardened release candidate itself is now deployed and verified.

- [x] Replay-before-quota ordering: commit `2c538165be92eb2819b76e2ffbdf65d3b687b1da` passed Nodra CI run 35545308181 and Security Engine run 35545308175. Signed duplicate requests are rejected by durable nonce replay protection before consuming process-local or distributed recorder quota.


- [x] Distributed protected-agent quota: commits `c1d3616`, `431e619`, and `0277117cd723c3367f6dc0bd6adcbab005b9b6fc` add a fixed server-controlled 30 requests/minute workspace quota before Gemini/OpenAI execution while retaining the process-local burst limiter. Nodra CI run 35545851994 and Nodra Security Engine run 35545852026 passed. The migration is applied to production; live privilege verification confirms RLS enabled, no authenticated direct SELECT/INSERT, authenticated RPC execution only, and no anonymous RPC execution. A transactional production-schema attack verified requests 1-30 are allowed, request 31 is denied with zero remaining and a positive retry delay, and workspace A cannot consume workspace B's quota; all temporary fixtures and quota state were rolled back.

- [x] Live distributed gateway exhaustion boundary: production-schema transactional assurance verified the fixed server-controlled gateway quota permits requests 1-240 for one authenticated workspace/agent and denies request 241 with remaining=0 and a positive retry delay. The assurance transaction was rolled back, leaving no test fixtures or quota state behind. This closes the defined live 240/241 gateway exhaustion check for #35.12.

- [x] Atomic safe-restart production-schema assurance: a transactional live test created an owner-scoped recovering incident with one quarantined laboratory agent and one deliberately paused laboratory agent. With all required remediation checks and human approval present, `complete_incident_restart` returned true, resolved the incident, restored only the quarantined agent to healthy, preserved both agents' existing authority scopes, and left the paused agent paused. The entire assurance fixture was rolled back after verification.

- [x] Privilege-bound restart attack: production-schema transactional verification proved an authenticated workspace viewer cannot invoke `complete_incident_restart`, while the workspace owner can complete the same fully remediated, human-approved recovery and resolve the incident. The fixture was rolled back after verification.
