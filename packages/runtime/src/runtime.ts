import { evaluatePolicy, type PolicyRule } from "@nodra/policy";
import { traceBlastRadius, type CausalEdge } from "@nodra/provenance";

export type LabRequest = { id: string; agentId: string; action: string; resourceId: string; causedBy?: string };
export type RecordedEvent = LabRequest & { decision: "allow" | "deny" | "require-approval"; reason: string };

export function intercept(request: LabRequest, rules: PolicyRule[]): RecordedEvent {
  const decision = evaluatePolicy({ agentId: request.agentId, action: request.action, resourceId: request.resourceId }, rules);
  return { ...request, decision: decision.effect, reason: decision.reason };
}

export function calculateBlastRadius(originAgentId: string, edges: CausalEdge[]) {
  return traceBlastRadius(originAgentId, edges);
}

export { NodraGateway, type ToolHandler, type GatewayResult } from "./gateway.ts";

export { ObservableNodraGateway, createObservableGateway, type GatewayObserver } from "./observable-gateway.ts";
