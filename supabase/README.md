# Nodra database

This directory contains the complete migration history exported from the active Nodra Supabase project.

## Security model

- Every public application table has Row Level Security enabled.
- Workspace membership is the tenant boundary.
- Direct authenticated writes to the tamper-evident event chain are denied; events use `append_security_event`.
- System recovery checks require adapter-produced remediation evidence.
- Safe restart requires all technical checks plus owner/admin approval.
- Laboratory reset resolves active incidents but preserves security events and their hash chain.

Four exposed `SECURITY DEFINER` functions are intentional trusted entry points: `append_security_event`, `record_gateway_intent`, `reset_laboratory`, and `run_laboratory_remediation_atomic`. Each validates authentication plus workspace membership or operator role internally. Their grants and function bodies must be reviewed together whenever changed.

## Verification

Before release:

1. Run `npm run verify:migrations`.
2. Apply all migrations to a clean Supabase branch/project.
3. Run Supabase security and performance advisors.
4. Verify two authenticated identities cannot read or mutate each other's workspace.
5. Verify direct event-chain mutation and direct adapter-evidence insertion are rejected.
6. Run `npm test`, `npm run typecheck`, and `npm run build`.

Run the transactional tenant-boundary suite against a disposable branch or an authorized database connection with `DATABASE_URL=... npm run verify:database`. The suite creates two temporary authenticated identities, verifies reciprocal read/write isolation and privileged RPC boundaries, then rolls the entire fixture back.
