import test from "node:test";import assert from "node:assert/strict";import {createHash,createHmac} from "node:crypto";import {Nodra} from "./index.ts";
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


test("automatic approval stops on human denial without executing approval claim", async () => {
  const credential = "ndra_auto_denial_test_1234567890123456789012";
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input: any) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/api/v1/authorize")) {
      return new Response(JSON.stringify({
        decision: "require-approval",
        reason: "explicit_policy_requires_approval",
        agentId: "finance-agent",
        resourceId: "stripe",
        action: "payments.submit",
        authorizationEventId: "33333333-3333-4333-8333-333333333333"
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.endsWith("/api/v1/approval-status")) {
      return new Response(JSON.stringify({
        status: "denied",
        reason: "Rejected by finance operations"
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "unexpected_call" }), { status: 500 });
  };

  try {
    const client = new Nodra({ baseUrl: "https://nodra.example", credential, maxRetries: 0 });
    await assert.rejects(
      () => client.protect({ id: "finance-agent" }).authorizeAndWait(
        { resourceId: "stripe", action: "payments.submit" },
        { timeoutMs: 1500, pollIntervalMs: 250 },
      ),
      (error: unknown) => error instanceof Error &&
        "code" in error &&
        (error as any).code === "approval_denied",
    );
    assert.deepEqual(
      calls.map((url) => new URL(url).pathname),
      ["/api/v1/authorize", "/api/v1/approval-status"],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("one-time approved execution never retries after ambiguous network failure", async () => {
  const credential = "ndra_no_retry_execute_123456789012345678901";
  let attempts = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    attempts++;
    throw new TypeError("network disconnected");
  };

  try {
    const client = new Nodra({
      baseUrl: "https://nodra.example",
      credential,
      maxRetries: 5,
    });

    await assert.rejects(
      () => client.executeApproved({
        agentId: "finance-agent",
        resourceId: "stripe",
        action: "payments.submit",
        authorizationEventId: "44444444-4444-4444-8444-444444444444",
        executionToken: "runtime-token-123456789012345678901234567890",
      }),
      (error: unknown) => error instanceof Error &&
        "code" in error &&
        (error as any).code === "network_error",
    );

    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("authorization context is signed as part of the request body", async () => {
  const credential = "ndra_context_signature_123456789012345678901";
  const originalFetch = globalThis.fetch;
  let captured: any;

  globalThis.fetch = async (_input: any, init: any) => {
    captured = init;
    return new Response(JSON.stringify({
      decision: "allow",
      reason: "authority_scope_allows",
      agentId: "finance-agent",
      resourceId: "stripe",
      action: "payments.submit",
      authorizationEventId: "55555555-5555-4555-8555-555555555555",
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const client = new Nodra({ baseUrl: "https://nodra.example", credential, maxRetries: 0 });
    await client.authorize({
      agentId: "finance-agent",
      resourceId: "stripe",
      action: "payments.submit",
      context: {
        amount: 5000,
        environment: "production",
        metadata: { currency: "USD" },
      },
    });

    const body = String(captured.body);
    assert.match(body, /"amount":5000/);
    assert.match(body, /"currency":"USD"/);

    const timestamp = captured.headers["x-nodra-timestamp"];
    const nonce = captured.headers["x-nodra-nonce"];
    const digest = createHash("sha256").update(body).digest("hex");
    const expected = "v1=" + createHmac("sha256", credential)
      .update(["v1", timestamp, nonce, digest].join("\n"))
      .digest("hex");

    assert.equal(captured.headers["x-nodra-signature"], expected);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
