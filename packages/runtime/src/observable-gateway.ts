import { NodraGateway, type ToolHandler } from "./gateway";
import type { LabRequest, RecordedEvent } from "./runtime";
import type { PolicyRule } from "@nodra/policy";

export type GatewayObserver = (event:RecordedEvent & { executed:boolean; occurredAt:string })=>Promise<void>|void;

export class ObservableNodraGateway extends NodraGateway {
  constructor(rules:PolicyRule[], tools:Record<string,ToolHandler>={}, private observer?:GatewayObserver){ super(rules,tools); }
  async execute<T=unknown>(request:LabRequest,input:unknown={}){
    const result=await super.execute<T>(request,input);
    await this.observer?.({...result.event,executed:result.executed,occurredAt:new Date().toISOString()});
    return result;
  }
}

export function createObservableGateway(rules:PolicyRule[],observer:GatewayObserver,tools:Record<string,ToolHandler>={}){
  return new ObservableNodraGateway(rules,tools,observer);
}
