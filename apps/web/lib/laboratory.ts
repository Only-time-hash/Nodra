import { intercept, calculateBlastRadius } from "@nodra/runtime";
import { quarantineBranch } from "@nodra/containment";
import type { PolicyRule } from "@nodra/policy";

export const laboratoryRules: PolicyRule[] = [
  { agentId: "research", resourceId: "browser", actions: ["read"] },
  { agentId: "research", resourceId: "notes", actions: ["write"] },
  { agentId: "finance", resourceId: "ledger", actions: ["read"] },
  { agentId: "finance", resourceId: "payments", actions: ["request"] },
  { agentId: "support", resourceId: "email", actions: ["draft"] },
  { agentId: "data", resourceId: "database", actions: ["read", "write"] },
];

export function simulateIncident() {
  const attemptedAction = intercept({ id: "evt-policy-block", agentId: "research", action: "request", resourceId: "payments", causedBy: "evt-untrusted-content" }, laboratoryRules);
  const causalEdges = [
    { from: "research", to: "manager", eventId: "evt-delegation", relation: "influenced" as const },
    { from: "manager", to: "finance", eventId: "evt-finance-task", relation: "delegated" as const },
  ];
  return { attemptedAction, affectedAgentIds: calculateBlastRadius("research", causalEdges) };
}

export function containLaboratoryIncident() {
  return quarantineBranch([
    { id: "manager", status: "at-risk", delegatedAuthority: true },
    { id: "research", status: "at-risk", delegatedAuthority: true },
    { id: "finance", status: "at-risk", delegatedAuthority: true },
    { id: "support", status: "healthy", delegatedAuthority: true },
    { id: "data", status: "healthy", delegatedAuthority: true },
  ], "research");
}
