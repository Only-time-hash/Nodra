# Nodra

**Containment, provenance, and recovery infrastructure for autonomous AI agents.**

Nodra is being built as a security control layer for autonomous and multi-agent systems. It is designed to control what agents can access and do, trace authority and propagation across connected systems, contain affected branches, preserve incident evidence, and support safe recovery.

## V0.1

The first working milestone focuses on a controlled multi-agent laboratory:

- Visual agent network
- Agent and tool permission boundaries
- Observable runtime events
- Simulated compromise in an owned sandbox
- Blast-radius and causality tracing
- Selective containment
- Incident timeline
- Recovery planning

Nodra is early-stage software. Security claims will be backed by implemented behavior and tests rather than marketing-only metrics.

## Planned repository layout

- `apps/web` — public website and Nodra control plane
- `packages/core` — shared domain model
- `packages/policy` — deterministic authorization policy
- `packages/runtime` — runtime event/interception primitives
- `packages/containment` — containment actions
- `packages/provenance` — authority and causality tracking
- `docs` — architecture and product documentation

## Development

The initial stack is TypeScript-first and intentionally modular without premature microservices.
