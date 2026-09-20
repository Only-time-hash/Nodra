import { evaluatePolicy, type PolicyRule } from "@nodra/policy";
import { traceBlastRadius, type CausalEdge } from "@nodra/provenance";

export type RuntimeRequest = {
  id: string;
  agentId: string;
  action: string;
  resourceId: string;
  causedBy?: string;
  amount?: number;
  context?: Record<string, unknown>;
};
/** @deprecated Use RuntimeRequest. Retained for V0.1 compatibility. */
export type LabRequest = RuntimeRequest;
export type RecordedEvent = RuntimeRequest & { decision: "allow" | "deny" | "require-approval"; reason: string };

export function intercept(request: RuntimeRequest, rules: PolicyRule[]): RecordedEvent {
  const decision = evaluatePolicy({
    agentId: request.agentId,
    action: request.action,
    resourceId: request.resourceId,
    amount: request.amount,
  }, rules);
  return { ...request, decision: decision.effect, reason: decision.reason };
}

export function calculateBlastRadius(originAgentId: string, edges: CausalEdge[]) {
  return traceBlastRadius(originAgentId, edges);
}

export { NodraGateway, type ToolHandler, type GatewayResult } from "./gateway.ts";
export { PostExecutionObservationError, ObservableNodraGateway, createObservableGateway, type GatewayObserver } from "./observable-gateway.ts";
