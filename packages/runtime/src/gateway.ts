import { intercept, type LabRequest, type RecordedEvent } from "./runtime.ts";
import type { PolicyRule } from "@nodra/policy";

export type ToolHandler<T = unknown> = (input: unknown) => Promise<T>;
export type GatewayResult<T = unknown> = { event: RecordedEvent; executed: boolean; output?: T };
export type RuntimeAgentState = "healthy" | "at-risk" | "restricted" | "quarantined";
export type AgentStateResolver = (agentId: string) => Promise<RuntimeAgentState> | RuntimeAgentState;

export class NodraGateway {
  private rules: PolicyRule[];
  private tools: Record<string, ToolHandler>;
  private resolveAgentState?: AgentStateResolver;

  constructor(rules: PolicyRule[], tools: Record<string, ToolHandler> = {}, resolveAgentState?: AgentStateResolver) {
    this.rules = rules;
    this.tools = tools;
    this.resolveAgentState = resolveAgentState;
  }

  register(resourceId: string, handler: ToolHandler) {
    this.tools[resourceId] = handler;
    return this;
  }

  async execute<T = unknown>(request: LabRequest, input: unknown = {}): Promise<GatewayResult<T>> {
    const state = this.resolveAgentState ? await this.resolveAgentState(request.agentId) : "healthy";
    if (state === "quarantined") {
      const event = { ...intercept(request, this.rules), decision: "deny" as const, reason: "Agent is quarantined by Nodra containment." };
      return { event, executed: false };
    }

    const event = intercept(request, this.rules);
    if (event.decision !== "allow") return { event, executed: false };

    // Restricted/at-risk agents keep only explicitly allowed read operations.
    // This is deliberately fail-closed for writes, payments, delegation, and unknown actions.
    if ((state === "restricted" || state === "at-risk") && request.action !== "read") {
      return {
        event: { ...event, decision: "deny", reason: `Agent authority reduced by Nodra containment (${state}).` },
        executed: false,
      };
    }

    const tool = this.tools[request.resourceId];
    if (!tool) return { event: { ...event, decision: "deny", reason: "No registered tool adapter." }, executed: false };
    const output = await tool(input) as T;
    return { event, executed: true, output };
  }
}
