# Nodra JavaScript quickstart

This guide shows how an external AI runtime protects a consequential action with the public Nodra SDK.

## 1. Install

```bash
npm install nodra-agent-sdk
```

## 2. Configure

Keep the Nodra credential server-side.

```bash
export NODRA_BASE_URL=https://your-nodra.example
export NODRA_CREDENTIAL=...
```

## 3. Protect an agent

```js
import { Nodra } from "nodra-agent-sdk";

const nodra = new Nodra({
  baseUrl: process.env.NODRA_BASE_URL,
  credential: process.env.NODRA_CREDENTIAL,
});

const finance = nodra.protect({ id: "finance-agent" });

const decision = await finance.authorize({
  resourceId: "stripe",
  action: "payments.submit",
  context: {
    amount: 5000,
    environment: "production",
    metadata: { currency: "USD" },
  },
});

if (decision.decision === "deny") {
  throw new Error(`Blocked by Nodra: ${decision.reason}`);
}

if (decision.decision === "require-approval") {
  const finalDecision = await finance.authorizeAndWait(
    {
      resourceId: "stripe",
      action: "payments.submit",
      context: {
        amount: 5000,
        environment: "production",
        metadata: { currency: "USD" },
      },
    },
    { timeoutMs: 5 * 60_000 },
  );

  if (finalDecision.decision !== "allow") {
    throw new Error("Payment was not approved.");
  }
}

// Execute the consequential tool only after Nodra allows it.
await submitPayment();

await finance.record({
  resourceId: "stripe",
  action: "payments.submit",
  decision: "allow",
  executed: true,
  phase: "result",
  outcome: "submitted",
});
```

For wrappers around framework tools, use the SDK adapters package.

## Security rules

- Never expose the credential to browser code.
- Treat `deny` and unavailable authorization as fail-closed.
- Do not execute a consequential action before the Nodra decision.
- Do not retry a one-time approved execution manually.
- Include stable resource/action names so policy and evidence remain understandable.
