export type AgentStatus = "healthy" | "at-risk" | "quarantined" | "paused";

export type NodraAgent = {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  parentAgentId?: string;
};

export type ResourceKind = "tool" | "credential" | "database" | "memory" | "job";

export type NodraResource = {
  id: string;
  name: string;
  kind: ResourceKind;
};

export type EventDecision = "allowed" | "blocked" | "approval-required";

export type RuntimeEvent = {
  id: string;
  timestamp: string;
  agentId: string;
  action: string;
  targetId?: string;
  decision: EventDecision;
  causedByEventId?: string;
};

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export type Incident = {
  id: string;
  title: string;
  severity: IncidentSeverity;
  originEventId: string;
  affectedAgentIds: string[];
  affectedResourceIds: string[];
};
