import assert from "node:assert/strict";
import test from "node:test";
import { signGatewayRequest, verifyGatewayRequest } from "./gateway-signing.ts";

const identity = {
  workspaceId: "workspace-a",
  agentId: "agent-a",
  masterSecret: "a-development-secret-that-is-at-least-32-bytes",
};
const timestamp = 1_800_000_000;
const nonce = "nonce_value_1234567890";
const body = JSON.stringify({ id: "request-1", agentId: "research", action: "read" });

test("accepts a correctly signed gateway request", () => {
  const signed = signGatewayRequest(body, identity, { timestamp, nonce });
  assert.deepEqual(
    verifyGatewayRequest(body, {
      timestamp: signed["x-nodra-timestamp"],
      nonce: signed["x-nodra-nonce"],
      signature: signed["x-nodra-signature"],
    }, identity, timestamp),
    { valid: true, timestamp, nonce },
  );
});

test("rejects body tampering", () => {
  const signed = signGatewayRequest(body, identity, { timestamp, nonce });
  const result = verifyGatewayRequest(`${body} `, {
    timestamp: signed["x-nodra-timestamp"],
    nonce: signed["x-nodra-nonce"],
    signature: signed["x-nodra-signature"],
  }, identity, timestamp);
  assert.deepEqual(result, { valid: false, reason: "signature_invalid" });
});

test("rejects another agent identity", () => {
  const signed = signGatewayRequest(body, identity, { timestamp, nonce });
  const result = verifyGatewayRequest(body, {
    timestamp: signed["x-nodra-timestamp"],
    nonce: signed["x-nodra-nonce"],
    signature: signed["x-nodra-signature"],
  }, { ...identity, agentId: "agent-b" }, timestamp);
  assert.deepEqual(result, { valid: false, reason: "signature_invalid" });
});

test("rejects expired signatures", () => {
  const signed = signGatewayRequest(body, identity, { timestamp, nonce });
  const result = verifyGatewayRequest(body, {
    timestamp: signed["x-nodra-timestamp"],
    nonce: signed["x-nodra-nonce"],
    signature: signed["x-nodra-signature"],
  }, identity, timestamp + 301);
  assert.deepEqual(result, { valid: false, reason: "signature_expired" });
});

test("rejects missing signature headers", () => {
  assert.deepEqual(
    verifyGatewayRequest(body, { timestamp: null, nonce: null, signature: null }, identity, timestamp),
    { valid: false, reason: "signature_headers_missing" },
  );
});
