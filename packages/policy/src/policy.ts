export type PolicyEffect = "allow" | "deny" | "require-approval";

export type PolicyRequest = {
  agentId: string;
  action: string;
  resourceId: string;
  amount?: number;
  environment?: string;
  occurredAt?: string | Date;
  metadata?: Record<string, string | number | boolean>;
};

export type PolicyDecision = {
  effect: PolicyEffect;
  reason: string;
  matchedPolicyId?: string;
};

export type PolicyConditions = {
  amountGreaterThan?: number;
  amountGreaterThanOrEqual?: number;
  amountLessThan?: number;
  amountLessThanOrEqual?: number;
  environmentIn?: string[];
  dayOfWeekIn?: number[];
  hourUtcFrom?: number;
  hourUtcUntil?: number;
  metadataEquals?: Record<string, string | number | boolean>;
};

export type PolicyRule = {
  id?: string;
  agentId?: string | null;
  resourceId?: string | null;
  actions: string[];
  effect?: PolicyEffect;
  priority?: number;
  enabled?: boolean;
  startsAt?: string | Date | null;
  expiresAt?: string | Date | null;
  conditions?: PolicyConditions;

  // Backward-compatible amount helpers.
  maxAmount?: number;
  requireApprovalAbove?: number;
};

function matchesPattern(value: string, pattern: string) {
  if (pattern === "*") return true;
  if (pattern.endsWith("*")) return value.startsWith(pattern.slice(0, -1));
  return value === pattern;
}

function toDate(value: string | Date | undefined | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function conditionsMatch(request: PolicyRequest, conditions: PolicyConditions = {}) {
  const amount = request.amount;

  if (conditions.amountGreaterThan !== undefined) {
    if (amount === undefined || !(amount > conditions.amountGreaterThan)) return false;
  }
  if (conditions.amountGreaterThanOrEqual !== undefined) {
    if (amount === undefined || !(amount >= conditions.amountGreaterThanOrEqual)) return false;
  }
  if (conditions.amountLessThan !== undefined) {
    if (amount === undefined || !(amount < conditions.amountLessThan)) return false;
  }
  if (conditions.amountLessThanOrEqual !== undefined) {
    if (amount === undefined || !(amount <= conditions.amountLessThanOrEqual)) return false;
  }

  if (conditions.environmentIn?.length) {
    if (!request.environment || !conditions.environmentIn.includes(request.environment)) {
      return false;
    }
  }

  const occurredAt = toDate(request.occurredAt) ?? new Date();

  if (conditions.dayOfWeekIn?.length) {
    if (!conditions.dayOfWeekIn.includes(occurredAt.getUTCDay())) return false;
  }

  if (conditions.hourUtcFrom !== undefined || conditions.hourUtcUntil !== undefined) {
    const hour = occurredAt.getUTCHours();
    const from = conditions.hourUtcFrom ?? 0;
    const until = conditions.hourUtcUntil ?? 24;

    if (from <= until) {
      if (!(hour >= from && hour < until)) return false;
    } else if (!(hour >= from || hour < until)) {
      return false;
    }
  }

  if (conditions.metadataEquals) {
    for (const [key, expected] of Object.entries(conditions.metadataEquals)) {
      if (request.metadata?.[key] !== expected) return false;
    }
  }

  return true;
}

function ruleMatches(request: PolicyRequest, rule: PolicyRule, now: Date) {
  if (rule.enabled === false) return false;

  const startsAt = toDate(rule.startsAt);
  if (startsAt && now < startsAt) return false;

  const expiresAt = toDate(rule.expiresAt);
  if (expiresAt && now >= expiresAt) return false;

  if (rule.agentId && rule.agentId !== "*" && rule.agentId !== request.agentId) {
    return false;
  }

  if (
    rule.resourceId &&
    rule.resourceId !== "*" &&
    !matchesPattern(request.resourceId, rule.resourceId)
  ) {
    return false;
  }

  if (!rule.actions.some((pattern) => matchesPattern(request.action, pattern))) {
    return false;
  }

  return conditionsMatch(request, rule.conditions);
}

export function evaluatePolicy(
  request: PolicyRequest,
  rules: PolicyRule[],
  now: Date = toDate(request.occurredAt) ?? new Date(),
): PolicyDecision {
  const matched = rules
    .filter((rule) => ruleMatches(request, rule, now))
    .sort((a, b) => (b.priority ?? 100) - (a.priority ?? 100));

  if (!matched.length) {
    return { effect: "deny", reason: "No matching permission rule." };
  }

  // Explicit deny always wins, regardless of allow priority.
  const explicitDeny = matched.find((rule) => (rule.effect ?? "allow") === "deny");
  if (explicitDeny) {
    return {
      effect: "deny",
      reason: "An explicit deny policy matched the request.",
      matchedPolicyId: explicitDeny.id,
    };
  }

  // Preserve legacy hard amount limits as a deny boundary.
  const hardLimit = matched.find(
    (rule) =>
      request.amount !== undefined &&
      rule.maxAmount !== undefined &&
      request.amount > rule.maxAmount,
  );
  if (hardLimit) {
    return {
      effect: "deny",
      reason: "Requested amount exceeds the hard policy limit.",
      matchedPolicyId: hardLimit.id,
    };
  }

  const explicitApproval = matched.find(
    (rule) => (rule.effect ?? "allow") === "require-approval",
  );
  if (explicitApproval) {
    return {
      effect: "require-approval",
      reason: "A human-approval policy matched the request.",
      matchedPolicyId: explicitApproval.id,
    };
  }

  const approvalThreshold = matched.find(
    (rule) =>
      request.amount !== undefined &&
      rule.requireApprovalAbove !== undefined &&
      request.amount > rule.requireApprovalAbove,
  );
  if (approvalThreshold) {
    return {
      effect: "require-approval",
      reason: "Human approval threshold reached.",
      matchedPolicyId: approvalThreshold.id,
    };
  }

  const explicitAllow = matched.find((rule) => (rule.effect ?? "allow") === "allow");
  if (explicitAllow) {
    return {
      effect: "allow",
      reason: "Request matches an explicit permission rule.",
      matchedPolicyId: explicitAllow.id,
    };
  }

  return { effect: "deny", reason: "No policy produced an allow decision." };
}
