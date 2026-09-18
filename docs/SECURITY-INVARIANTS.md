# Nodra Security Invariants

These are properties the implementation must preserve. They are stronger than UI behavior and should gain regression tests as the system evolves.

1. **Default deny:** an action without explicit authority is denied.
2. **Hard limits outrank approval:** an approval threshold cannot override a hard maximum.
3. **Containment is selective:** an affected origin can be quarantined without automatically stopping unrelated healthy agents.
4. **Authority revocation is explicit:** quarantining an agent removes its delegated authority in the containment state.
5. **Blast radius is evidence-based:** affected nodes come from recorded causal edges, not arbitrary UI labels.
6. **Recovery is not restart:** containment or recovery-plan creation alone never marks a system safe to restart.
7. **Human approval remains consequential:** the V0.1 safe-restart assessment requires explicit human approval after technical checks.
8. **Observable evidence only:** Nodra records actions, requests, policy decisions, resource access and causal metadata; it does not claim to capture private model chain-of-thought.
9. **Sandbox attack testing:** deliberate compromise scenarios are limited to owned/authorized test environments.

Any change that violates an invariant should fail review even if the interface still appears to work.
