# Nodra V0.1 Architecture

## Product goal

Nodra is a control plane for autonomous AI systems focused on containment, provenance, blast-radius analysis, incident reconstruction, and recovery.

## V0.1 proof

The first proof is deliberately narrow: demonstrate that one compromised agent in an owned five-agent sandbox can be detected, traced, selectively contained, and prepared for recovery without shutting down unaffected agents.

## Laboratory topology

Human -> Manager Agent -> Research Agent / Finance Agent / Communication Agent / Data Agent

The laboratory uses simulated tools first so security behavior is deterministic and safe to test. Real external integrations are added only after the security model is working.

## Runtime path

Agent -> Nodra runtime gateway -> deterministic policy decision -> tool adapter

Every consequential request creates an observable event. The gateway is the enforcement point; an LLM may help classify or explain risk later, but it does not override hard policy.

## Core domains

- **Core:** agents, tools, credentials, resources, events, incidents and actions.
- **Policy:** explicit allow/deny/approval rules and limits.
- **Provenance:** authority, delegation and causal relationships.
- **Containment:** pause, restrict, quarantine, revoke and terminate primitives.
- **Recovery:** classify affected actions and construct a human-reviewable recovery plan.

## Safety boundary

V0.1 attack scenarios run only inside Nodra's owned sandbox. The project does not require compromising third-party systems.
