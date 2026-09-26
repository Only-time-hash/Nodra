# Nodra Agent SDK

Protect consequential AI-agent actions with Nodra's deterministic authorization gateway.

## Install

```bash
npm install nodra-agent-sdk
```

## Quick start

```ts
import { Nodra } from "nodra-agent-sdk";

const nodra = new Nodra({
  baseUrl: process.env.NODRA_BASE_URL!,
  credential: process.env.NODRA_CREDENTIAL!,
});

const finance = nodra.protect({ id: "finance-agent" });

const decision = await finance.authorize({
  resourceId: "stripe",
  action: "payments.submit",
});

if (decision.decision === "allow") {
  // execute the protected action
}

if (decision.decision === "require-approval") {
  // wait for a human approval and then call executeApproved()
}
```

## Protected tool helper

```ts
import { Nodra } from "nodra-agent-sdk";
import { protectTool } from "nodra-agent-sdk/adapters";

const nodra = new Nodra({
  baseUrl: process.env.NODRA_BASE_URL!,
  credential: process.env.NODRA_CREDENTIAL!,
});

const result = await protectTool(
  nodra,
  {
    agentId: "finance-agent",
    resourceId: "stripe",
    action: "payments.submit",
  },
  async () => {
    return await submitPayment();
  },
);
```

Nodra only executes the supplied tool callback when authorization returns `allow`.

## Approval execution

When authorization returns `require-approval`, the returned `authorizationEventId` identifies the approval request. After an authorized reviewer approves it and a one-time execution token is delivered to the runtime:

```ts
await finance.executeApproved({
  resourceId: "stripe",
  action: "payments.submit",
  authorizationEventId,
  executionToken,
});
```

Execution tokens are one-time and expire.

## Configuration

```ts
const nodra = new Nodra({
  baseUrl: "https://your-nodra.example",
  credential: process.env.NODRA_CREDENTIAL!,
  timeoutMs: 8_000,
  maxRetries: 2,
});
```

Keep Nodra credentials server-side. Never embed them in browser applications.

## Error handling

```ts
import { NodraError } from "nodra-agent-sdk";

try {
  await finance.authorize({
    resourceId: "stripe",
    action: "payments.submit",
  });
} catch (error) {
  if (error instanceof NodraError) {
    console.error(error.code, error.status, error.requestId);
  }
}
```
