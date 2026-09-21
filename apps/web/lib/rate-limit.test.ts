import test from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, resetRateLimitsForTests } from "./rate-limit.ts";

test("rate limiter allows up to the configured workspace budget then denies", () => {
  resetRateLimitsForTests();
  assert.equal(checkRateLimit("workspace-a", 2, 60_000, 1_000).allowed, true);
  const second = checkRateLimit("workspace-a", 2, 60_000, 1_001);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);
  const third = checkRateLimit("workspace-a", 2, 60_000, 1_002);
  assert.equal(third.allowed, false);
  assert.ok(third.retryAfterSeconds > 0);
});

test("rate limiter isolates workspace identities", () => {
  resetRateLimitsForTests();
  checkRateLimit("workspace-a", 1, 60_000, 1_000);
  assert.equal(checkRateLimit("workspace-a", 1, 60_000, 1_001).allowed, false);
  assert.equal(checkRateLimit("workspace-b", 1, 60_000, 1_001).allowed, true);
});

test("rate limiter resets after its window", () => {
  resetRateLimitsForTests();
  checkRateLimit("workspace-a", 1, 1_000, 1_000);
  assert.equal(checkRateLimit("workspace-a", 1, 1_000, 1_500).allowed, false);
  assert.equal(checkRateLimit("workspace-a", 1, 1_000, 2_000).allowed, true);
});

test("rate limiter rejects unsafe configuration", () => {
  resetRateLimitsForTests();
  assert.throws(() => checkRateLimit("x", 0, 1_000), /invalid rate limit configuration/);
  assert.throws(() => checkRateLimit("x", 1, 0), /invalid rate limit configuration/);
  assert.throws(() => checkRateLimit("", 1, 1_000), /invalid rate limit configuration/);
  assert.throws(() => checkRateLimit("x".repeat(513), 1, 1_000), /invalid rate limit configuration/);
});
