import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluatePolicy } from "./policy.ts";

describe("policy", () => {
  it("denies missing authority by default", () => {
    const decision = evaluatePolicy(
      { agentId: "research", action: "request", resourceId: "payments" },
      [{ agentId: "research", resourceId: "browser", actions: ["read"] }],
    );
    assert.equal(decision.effect, "deny");
  });

  it("requires approval above legacy threshold", () => {
    const decision = evaluatePolicy(
      { agentId: "finance", action: "request", resourceId: "payments", amount: 500 },
      [{
        id: "finance-limit",
        agentId: "finance",
        resourceId: "payments",
        actions: ["request"],
        maxAmount: 1000,
        requireApprovalAbove: 100,
      }],
    );
    assert.equal(decision.effect, "require-approval");
    assert.equal(decision.matchedPolicyId, "finance-limit");
  });

  it("hard-denies above legacy maximum", () => {
    const decision = evaluatePolicy(
      { agentId: "finance", action: "request", resourceId: "payments", amount: 1500 },
      [{
        id: "finance-limit",
        agentId: "finance",
        resourceId: "payments",
        actions: ["request"],
        maxAmount: 1000,
        requireApprovalAbove: 100,
      }],
    );
    assert.equal(decision.effect, "deny");
  });

  it("explicit deny overrides a higher-priority allow", () => {
    const decision = evaluatePolicy(
      { agentId: "finance", action: "payments.submit", resourceId: "stripe" },
      [
        {
          id: "allow-payments",
          agentId: "finance",
          resourceId: "stripe",
          actions: ["payments.*"],
          effect: "allow",
          priority: 1000,
        },
        {
          id: "deny-submit",
          agentId: "finance",
          resourceId: "stripe",
          actions: ["payments.submit"],
          effect: "deny",
          priority: 1,
        },
      ],
    );
    assert.equal(decision.effect, "deny");
    assert.equal(decision.matchedPolicyId, "deny-submit");
  });

  it("matches wildcard action and resource patterns", () => {
    const decision = evaluatePolicy(
      { agentId: "support", action: "tickets.update", resourceId: "zendesk:eu" },
      [{
        id: "support-tickets",
        agentId: "support",
        resourceId: "zendesk:*",
        actions: ["tickets.*"],
        effect: "allow",
      }],
    );
    assert.equal(decision.effect, "allow");
  });

  it("matches amount, environment, time and metadata conditions", () => {
    const decision = evaluatePolicy(
      {
        agentId: "finance",
        action: "payments.submit",
        resourceId: "stripe",
        amount: 5000,
        environment: "production",
        occurredAt: "2026-09-28T10:30:00.000Z",
        metadata: { currency: "USD", riskBand: "high" },
      },
      [{
        id: "large-payment-review",
        agentId: "finance",
        resourceId: "stripe",
        actions: ["payments.submit"],
        effect: "require-approval",
        conditions: {
          amountGreaterThanOrEqual: 1000,
          environmentIn: ["production"],
          dayOfWeekIn: [1],
          hourUtcFrom: 9,
          hourUtcUntil: 17,
          metadataEquals: { currency: "USD", riskBand: "high" },
        },
      }],
    );

    assert.equal(decision.effect, "require-approval");
    assert.equal(decision.matchedPolicyId, "large-payment-review");
  });

  it("ignores expired policies", () => {
    const decision = evaluatePolicy(
      {
        agentId: "finance",
        action: "payments.submit",
        resourceId: "stripe",
        occurredAt: "2026-09-26T12:00:00.000Z",
      },
      [{
        id: "expired",
        agentId: "finance",
        resourceId: "stripe",
        actions: ["payments.submit"],
        effect: "allow",
        expiresAt: "2026-09-25T12:00:00.000Z",
      }],
    );

    assert.equal(decision.effect, "deny");
  });

  it("handles overnight UTC windows", () => {
    const rule = {
      id: "night-window",
      agentId: "ops",
      resourceId: "scheduler",
      actions: ["jobs.run"],
      effect: "allow" as const,
      conditions: {
        hourUtcFrom: 22,
        hourUtcUntil: 6,
      },
    };

    assert.equal(
      evaluatePolicy(
        {
          agentId: "ops",
          action: "jobs.run",
          resourceId: "scheduler",
          occurredAt: "2026-09-26T23:00:00.000Z",
        },
        [rule],
      ).effect,
      "allow",
    );

    assert.equal(
      evaluatePolicy(
        {
          agentId: "ops",
          action: "jobs.run",
          resourceId: "scheduler",
          occurredAt: "2026-09-26T12:00:00.000Z",
        },
        [rule],
      ).effect,
      "deny",
    );
  });
});
