import { NodraGateway, type ToolHandler } from "./gateway.ts";
import type { LabRequest, RecordedEvent } from "./runtime.ts";
import type { PolicyRule } from "@nodra/policy";

export type GatewayObserver = (event: RecordedEvent & { executed: boolean; occurredAt: string }) => Promise<void> | void;

export class ObservableNodraGateway extends NodraGateway {
  private observer?: GatewayObserver;

  constructor(rules: PolicyRule[], tools: Record<string, ToolHandler> = {}, observer?: GatewayObserver) {
    super(rules, tools);
    this.observer = observer;
  }

  async execute<T = unknown>(request: LabRequest, input: unknown = {}) {
    const result = await super.execute<T>(request, input);
    await this.observer?.({ ...result.event, executed: result.executed, occurredAt: new Date().toISOString() });
    return result;
  }
}

export function createObservableGateway(rules: PolicyRule[], observer: GatewayObserver, tools: Record<string, ToolHandler> = {}) {
  return new ObservableNodraGateway(rules, tools, observer);
}
