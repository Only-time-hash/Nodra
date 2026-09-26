import { createServer } from "node:http";
import assert from "node:assert/strict";
import { Nodra } from "nodra-agent-sdk";

const credential = "ndra_external_consumer_123456789012345678901234567890";
const authorizationEventId = "77777777-7777-4777-8777-777777777777";
const paths = [];

const server = createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  paths.push(req.url);

  assert.equal(typeof req.headers["x-nodra-signature"], "string");
  assert.equal(typeof req.headers["x-nodra-timestamp"], "string");
  assert.equal(typeof req.headers["x-nodra-nonce"], "string");
  assert.equal(req.headers["x-nodra-credential"], credential);

  const payload = JSON.parse(body || "{}");
  res.setHeader("content-type", "application/json");
  res.setHeader("x-nodra-api-version", "v1");

  if (req.url === "/api/v1/authorize") {
    assert.equal(payload.agentId, "external-finance-agent");
    assert.equal(payload.resourceId, "stripe");
    assert.equal(payload.action, "payments.submit");
    assert.equal(payload.context.amount, 5000);
    res.end(JSON.stringify({
      decision: "require-approval",
      reason: "explicit_policy_requires_approval",
      agentId: payload.agentId,
      resourceId: payload.resourceId,
      action: payload.action,
      authorizationEventId,
    }));
    return;
  }

  if (req.url === "/api/v1/approval-status") {
    res.end(JSON.stringify({
      status: "approved",
      reason: "Reviewed by finance operations",
      decidedAt: new Date().toISOString(),
    }));
    return;
  }

  if (req.url === "/api/v1/approval-claim") {
    assert.equal(payload.authorizationEventId, authorizationEventId);
    assert.ok(payload.executionToken.length >= 24);
    res.end(JSON.stringify({
      status: "approved",
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    }));
    return;
  }

  if (req.url === "/api/v1/execute-approved") {
    assert.equal(payload.authorizationEventId, authorizationEventId);
    assert.ok(payload.executionToken.length >= 24);
    res.end(JSON.stringify({
      decision: "allow",
      reason: "human_approval_consumed",
      authorizationEventId,
      executionEventId: "88888888-8888-4888-8888-888888888888",
      agentId: payload.agentId,
      resourceId: payload.resourceId,
      action: payload.action,
    }));
    return;
  }

  if (req.url === "/api/v1/events") {
    res.end(JSON.stringify({ recorded: true, eventId: "99999999-9999-4999-8999-999999999999" }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "not_found" }));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("server_address_unavailable");

try {
  const nodra = new Nodra({
    baseUrl: `http://127.0.0.1:${address.port}`,
    credential,
    maxRetries: 0,
  });

  const finance = nodra.protect({ id: "external-finance-agent" });

  const decision = await finance.authorizeAndWait(
    {
      resourceId: "stripe",
      action: "payments.submit",
      context: {
        amount: 5000,
        environment: "production",
        metadata: { currency: "USD" },
      },
    },
    { timeoutMs: 2_000, pollIntervalMs: 250 },
  );

  assert.equal(decision.decision, "allow");
  assert.equal(decision.reason, "human_approval_consumed");

  await finance.record({
    resourceId: "stripe",
    action: "payments.submit",
    decision: "allow",
    phase: "result",
    executed: true,
    outcome: "submitted",
    reason: decision.reason,
  });

  assert.deepEqual(paths, [
    "/api/v1/authorize",
    "/api/v1/approval-status",
    "/api/v1/approval-claim",
    "/api/v1/execute-approved",
    "/api/v1/events",
  ]);

  console.log("external consumer integration passed");
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  );
}
