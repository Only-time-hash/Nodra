# V0.1 Release Verification

A release is not considered verified until every required check below has evidence.

## Automated
- [x] npm dependencies install from committed lockfile with npm ci.
- [x] Runtime, policy, containment, recovery and laboratory tests pass.
- [x] TypeScript typecheck passes.
- [x] Next.js production build passes.
- [x] Five-agent selective containment acceptance test passes.
- [x] Recovery refuses restart without every system check and human approval.
- [x] Gateway signatures reject body tampering, cross-agent identity use and expired requests.

## Database security
- [x] Two distinct authenticated identities cannot cross workspace boundaries.
- [x] Anonymous execution denied for event recorder, restart assessment and laboratory reset.
- [x] Direct authenticated security-event insert/update denied.
- [x] Direct authenticated remediation-evidence insert denied.
- [x] Direct authenticated remediation-action update denied.
- [x] Cross-incident remediation evidence is rejected by the transactional database security suite.
- [x] Signed gateway nonces are single-use and reject database-level replay.
- [x] Security Advisor reviewed; any remaining warning is documented and intentional.


## Adversarial assurance matrix
- [ ] Goal/prompt hijacking cannot expand the Research agent's allowed browser:read / notes:write authority.
- [ ] Tool arguments are schema-validated before protected adapter execution.
- [ ] Unknown, paused, offline, or unresolved agent state fails closed.
- [x] Signed gateway request tampering and cross-agent identity use are rejected.
- [x] Gateway replay is rejected after nonce consumption.
- [x] Cross-workspace data access is rejected by RLS verification.
- [x] Incident evidence remains isolated to its incident.
- [x] Recovery cannot complete without remediation evidence and authorized human approval.
- [ ] Provider failure, timeout, malformed model JSON, and unavailable recorder all fail without executing an unauthorized tool.
- [ ] Production model credentials use the provider's current restricted/auth-key mechanism and remain server-side.
- [ ] Release candidate receives an independent verification pass against the assurance invariants in docs/v0.1.md.

## Production
- [x] GitHub OAuth completes callback and onboarding.
- [ ] Gemini model call succeeds through the protected runtime path.
- [x] Incident → containment → investigation → remediation → approval → restart succeeds.
- [x] Support remains healthy in the five-agent scenario.
- [ ] Desktop, tablet and mobile layouts are visually tested.
- [x] Stable production alias serves the verified commit.

Do not mark V0.1 released while a required unchecked item remains.
