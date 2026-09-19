# V0.1 Release Verification

A release is not considered verified until every required check below has evidence.

## Automated
- [ ] npm dependencies install from committed lockfile with npm ci.
- [ ] Runtime, policy, containment, recovery and laboratory tests pass.
- [ ] TypeScript typecheck passes.
- [ ] Next.js production build passes.
- [ ] Five-agent selective containment acceptance test passes.
- [ ] Recovery refuses restart without every system check and human approval.

## Database security
- [ ] Two distinct authenticated identities cannot cross workspace boundaries.
- [x] Anonymous execution denied for event recorder, restart assessment and laboratory reset.
- [x] Direct authenticated security-event insert/update denied.
- [x] Direct authenticated remediation-evidence insert denied.
- [x] Direct authenticated remediation-action update denied.
- [ ] Cross-incident remediation evidence is rejected.
- [ ] Security Advisor reviewed; any remaining warning is documented and intentional.

## Production
- [ ] GitHub OAuth completes callback and onboarding.
- [ ] Gemini model call succeeds through the protected runtime path.
- [ ] Incident → containment → investigation → remediation → approval → restart succeeds.
- [ ] Support remains healthy in the five-agent scenario.
- [ ] Desktop, tablet and mobile layouts are visually tested.
- [ ] Stable production alias serves the verified commit.

Do not mark V0.1 released while a required unchecked item remains.
