import test from "node:test";import assert from "node:assert/strict";import {Nodra} from "./index.ts";
test("protect exposes runtime helpers",()=>{const n=new Nodra({baseUrl:"https://example.test",workspaceId:"workspace",credential:"12345678901234567890123456789012"});const a=n.protect({id:"support"});assert.equal(typeof a.authorize,"function");assert.equal(typeof a.executeApproved,"function");assert.equal(typeof a.intent,"function");assert.equal(typeof a.result,"function");assert.equal(typeof a.record,"function")});


test("authorizeAndWait claims approval and consumes it automatically", async () => {
  const credential = "ndra_auto_approval_test_12345678901234567890";
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input: any) => {
    const url = String(input);
    calls.push(url);

    if (url.endsWith("/api/v1/authorize")) {
      return new Response(JSON.stringify({
        decision: "require-approval",
        reason: "workspace_high_impact_review",
        agentId: "finance-agent",
        resourceId: "stripe",
        action: "payments.submit",
        authorizationEventId: "11111111-1111-4111-8111-111111111111"
      }), { status: 200, headers: { "content-type": "application/json" } });
    }

    if (url.endsWith("/api/v1/approval-status")) {
      return new Response(JSON.stringify({
        status: "approved",
        reason: "approved by analyst",
        decidedAt: new Date().toISOString()
      }), { status: 200, headers: { "content-type": "application/json" } });
    }

    if (url.endsWith("/api/v1/approval-claim")) {
      return new Response(JSON.stringify({
        status: "approved",
        expiresAt: new Date(Date.now() + 300000).toISOString()
      }), { status: 200, headers: { "content-type": "application/json" } });
    }

    if (url.endsWith("/api/v1/execute-approved")) {
      return new Response(JSON.stringify({
        decision: "allow",
        reason: "human_approval_consumed",
        agentId: "finance-agent",
        resourceId: "stripe",
        action: "payments.submit",
        authorizationEventId: "11111111-1111-4111-8111-111111111111",
        executionEventId: "22222222-2222-4222-8222-222222222222"
      }), { status: 200, headers: { "content-type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unexpected_test_url" }), { status: 500 });
  };

  try {
    const client = new Nodra({
      baseUrl: "https://nodra.example",
      credential,
      maxRetries: 0,
    });

    const decision = await client.protect({ id: "finance-agent" }).authorizeAndWait(
      { resourceId: "stripe", action: "payments.submit" },
      { timeoutMs: 2000, pollIntervalMs: 250 },
    );

    assert.equal(decision.decision, "allow");
    assert.equal(decision.reason, "human_approval_consumed");
    assert.deepEqual(
      calls.map((url) => new URL(url).pathname),
      [
        "/api/v1/authorize",
        "/api/v1/approval-status",
        "/api/v1/approval-claim",
        "/api/v1/execute-approved",
      ],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
