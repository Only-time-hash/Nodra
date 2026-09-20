import { NodraGateway, type ToolHandler, type AgentStateResolver, type ApprovalResolver } from "./gateway.ts";
import type { LabRequest, RecordedEvent } from "./runtime.ts";
import type { PolicyRule } from "@nodra/policy";

export type GatewayObservation = RecordedEvent & {
  phase: "intent" | "result";
  executed: boolean;
  occurredAt: string;
  outcome?: "succeeded" | "blocked" | "failed";
  error?: string;
};
export type GatewayObserver = (event: GatewayObservation) => Promise<void> | void;

export class PostExecutionObservationError extends Error {
  readonly requestId:string;
  readonly executed=true;
  constructor(requestId:string,cause:unknown){
    super("Tool executed but result recording failed; do not retry automatically.",{cause});
    this.name="PostExecutionObservationError";
    this.requestId=requestId;
  }
}

export class ObservableNodraGateway extends NodraGateway {
  private observer?: GatewayObserver;

  constructor(
    rules: PolicyRule[],
    tools: Record<string, ToolHandler> = {},
    observer?: GatewayObserver,
    resolveAgentState?: AgentStateResolver,
    resolveApproval?: ApprovalResolver,
  ) {
    super(rules, tools, resolveAgentState, resolveApproval);
    this.observer = observer;
  }

  async execute<T = unknown>(request: LabRequest, input: unknown = {}) {
    const intent = {
      id: request.id,
      agentId: request.agentId,
      resourceId: request.resourceId,
      action: request.action,
      causedBy: request.causedBy,
      decision: "require-approval" as const,
      reason: "Execution intent received; policy and containment checks pending.",
    };
    await this.observer?.({ ...intent, phase: "intent", executed: false, occurredAt: new Date().toISOString() });

    try {
      const result = await super.execute<T>(request, input);
      try {
        await this.observer?.({
          ...result.event,
          phase: "result",
          executed: result.executed,
          outcome: result.executed ? "succeeded" : "blocked",
          occurredAt: new Date().toISOString(),
        });
      } catch (error) {
        if(result.executed) throw new PostExecutionObservationError(request.id,error);
        throw error;
      }
      return result;
    } catch (error) {
      await this.observer?.({
        ...intent,
        decision: "deny",
        reason: "Tool execution failed.",
        phase: "result",
        executed: false,
        outcome: "failed",
        error: error instanceof Error ? error.message : "unknown_error",
        occurredAt: new Date().toISOString(),
      });
      throw error;
    }
  }
}

export function createObservableGateway(
  rules: PolicyRule[],
  observer: GatewayObserver,
  tools: Record<string, ToolHandler> = {},
  resolveAgentState?: AgentStateResolver,
  resolveApproval?: ApprovalResolver,
) {
  return new ObservableNodraGateway(rules, tools, observer, resolveAgentState, resolveApproval);
}
