# Nodra customer integration

Nodra is a hosted security command center plus a security boundary inside the customer's agent runtime.

## Integration paths
1. Node SDK: applications send signed intent/result events through @nodra/sdk.
2. Gateway: enterprises run a gateway beside agents and route protected tool activity through it.
3. Platform connectors: future adapters can map OpenAI Agents, MCP, LangChain, CrewAI and custom REST runtimes onto the same gateway contract.

## Production flow
Create workspace -> register agent identity -> provision signing credential -> send signed test event -> verify Activity -> configure policy/authority -> route protected tool calls through Nodra -> activate production protection.

## Security boundary
Signing secrets stay server-side. Never expose them in browser JavaScript or mobile clients. Gateway requests use timestamp, nonce and HMAC signatures and are rejected on replay. Agent IDs must already be registered in the workspace.

A production integration must not confuse recording with enforcement: protected applications must obtain an allow/approval decision before executing a sensitive tool. The hosted dashboard is the operator surface for incidents, evidence, containment, recovery and reports.
