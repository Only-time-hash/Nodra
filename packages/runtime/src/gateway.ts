import { intercept, type LabRequest, type RecordedEvent } from "./runtime.ts";
import type { PolicyRule } from "@nodra/policy";

export type ToolHandler<T = unknown> = (input: unknown) => Promise<T>;
export type GatewayResult<T = unknown> = { event: RecordedEvent; executed: boolean; output?: T };

export class NodraGateway {
  private rules: PolicyRule[];
  private tools: Record<string, ToolHandler>;

  constructor(rules: PolicyRule[], tools: Record<string, ToolHandler> = {}) {
    this.rules = rules;
    this.tools = tools;
  }

  register(resourceId: string, handler: ToolHandler) {
    this.tools[resourceId] = handler;
    return this;
  }

  async execute<T = unknown>(request: LabRequest, input: unknown = {}): Promise<GatewayResult<T>> {
    const event = intercept(request, this.rules);
    if (event.decision !== "allow") return { event, executed: false };
    const tool = this.tools[request.resourceId];
    if (!tool) return { event: { ...event, decision: "deny", reason: "No registered tool adapter." }, executed: false };
    const output = await tool(input) as T;
    return { event, executed: true, output };
  }
}
