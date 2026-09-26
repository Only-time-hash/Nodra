import assert from "node:assert/strict";
import { Nodra } from "nodra-agent-sdk";

const baseUrl = process.env.NODRA_BASE_URL;
const credential = process.env.NODRA_CREDENTIAL;
const agentId = process.env.NODRA_AGENT_ID || "finance-agent";
const resourceId = process.env.NODRA_TEST_RESOURCE || "stripe";
const action = process.env.NODRA_TEST_ACTION || "payments.submit";
const waitForApproval = process.env.NODRA_WAIT_FOR_APPROVAL === "1";

if (!baseUrl) throw new Error("NODRA_BASE_URL is required");
if (!credential) throw new Error("NODRA_CREDENTIAL is required");

const nodra = new Nodra({
  baseUrl,
  credential,
  maxRetries: 2,
  timeoutMs: 8_000,
});

const agent = nodra.protect({ id: agentId });

const request = {
  resourceId,
  action,
  context: {
    environment: process.env.NODRA_ENVIRONMENT || "production",
    ...(process.env.NODRA_TEST_AMOUNT
      ? { amount: Number(process.env.NODRA_TEST_AMOUNT) }
      : {}),
    metadata: {
      source: "external-pilot",
      runtime: "node",
    },
  },
};

const decision = waitForApproval
  ? await agent.authorizeAndWait(request, {
      timeoutMs: Number(process.env.NODRA_APPROVAL_TIMEOUT_MS || 300_000),
      pollIntervalMs: 1_500,
    })
  : await agent.authorize(request);

assert.ok(["allow", "deny", "require-approval"].includes(decision.decision));

console.log(JSON.stringify({
  connected: true,
  agentId,
  resourceId,
  action,
  decision: decision.decision,
  reason: decision.reason,
  authorizationEventId: decision.authorizationEventId,
}, null, 2));

if (decision.decision === "allow" && process.env.NODRA_RECORD_PILOT_RESULT === "1") {
  const recorded = await agent.record({
    resourceId,
    action,
    decision: "allow",
    phase: "result",
    executed: false,
    outcome: "pilot-verification-only",
    reason: "external_pilot_connectivity_verified",
  });

  console.log(JSON.stringify({
    evidenceRecorded: recorded.recorded,
    eventId: recorded.eventId ?? null,
  }, null, 2));
}
