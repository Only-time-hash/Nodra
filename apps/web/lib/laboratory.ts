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
  const causalEdges = fiveAgentScenario.propagation.map((edge,index) => ({
    ...edge,
    eventId: `evt-propagation-${index + 1}`,
  }));
  return { attemptedAction, affectedAgentIds: calculateBlastRadius("research", causalEdges) };
}

export function containLaboratoryIncident() {
  const affected=new Set(fiveAgentScenario.expectedContained);
  return quarantineBranch([
    { id: "manager", status: affected.has("manager") ? "at-risk" : "healthy", delegatedAuthority: true },
    { id: "research", status: affected.has("research") ? "at-risk" : "healthy", delegatedAuthority: true },
    { id: "finance", status: affected.has("finance") ? "at-risk" : "healthy", delegatedAuthority: true },
    { id: "support", status: affected.has("support") ? "at-risk" : "healthy", delegatedAuthority: true },
    { id: "data", status: affected.has("data") ? "at-risk" : "healthy", delegatedAuthority: true },
  ], fiveAgentScenario.origin);
}


export const fiveAgentScenario = {
  origin: "research",
  propagation: [
    { from: "research", to: "manager", relation: "influenced" },
    { from: "manager", to: "finance", relation: "delegated" },
    { from: "manager", to: "data", relation: "delegated" },
  ],
  expectedContained: ["research", "manager", "finance", "data"],
  expectedHealthy: ["support"],
} as const;

export function verifySelectiveContainment(statuses: Record<string,string>) {
  return fiveAgentScenario.expectedContained.every(id=>statuses[id] === "quarantined" || statuses[id] === "restricted" || statuses[id] === "at-risk")
    && fiveAgentScenario.expectedHealthy.every(id=>statuses[id] === "healthy");
}
