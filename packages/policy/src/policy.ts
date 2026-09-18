export type PolicyRequest = {
  agentId: string;
  action: string;
  resourceId: string;
  amount?: number;
};

export type PolicyDecision = {
  effect: "allow" | "deny" | "require-approval";
  reason: string;
};

export type PolicyRule = {
  agentId: string;
  resourceId: string;
  actions: string[];
  maxAmount?: number;
  requireApprovalAbove?: number;
};

export function evaluatePolicy(request: PolicyRequest, rules: PolicyRule[]): PolicyDecision {
  const rule = rules.find(
    (candidate) =>
      candidate.agentId === request.agentId &&
      candidate.resourceId === request.resourceId &&
      candidate.actions.includes(request.action),
  );

  if (!rule) return { effect: "deny", reason: "No matching permission rule." };

  if (request.amount !== undefined && rule.maxAmount !== undefined && request.amount > rule.maxAmount) {
    return { effect: "deny", reason: "Requested amount exceeds the hard policy limit." };
  }

  if (
    request.amount !== undefined &&
    rule.requireApprovalAbove !== undefined &&
    request.amount > rule.requireApprovalAbove
  ) {
    return { effect: "require-approval", reason: "Human approval threshold reached." };
  }

  return { effect: "allow", reason: "Request matches an explicit permission rule." };
}
