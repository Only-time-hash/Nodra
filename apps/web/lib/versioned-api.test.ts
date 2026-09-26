import assert from "node:assert/strict";
import test from "node:test";
import { versionedResponse } from "./versioned-api.ts";

test("v1 wrapper attaches stable version and request id", async () => {
  const request = new Request("https://nodra.example/api/v1/health");
  const response = await versionedResponse(
    async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    request,
  );

  assert.equal(response.headers.get("x-nodra-api-version"), "v1");
  assert.ok(response.headers.get("x-nodra-request-id"));
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("v1 wrapper preserves caller supplied request id", async () => {
  const request = new Request("https://nodra.example/api/v1/health", {
    headers: { "x-nodra-request-id": "customer-trace-123" },
  });
  const response = await versionedResponse(
    async () => new Response(null, { status: 204 }),
    request,
  );

  assert.equal(response.headers.get("x-nodra-request-id"), "customer-trace-123");
});
