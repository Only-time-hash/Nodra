import { createObservableGateway, type GatewayObserver, type AgentStateResolver } from "@nodra/runtime";

const rules = [
  { agentId: "example-research", resourceId: "notes", actions: ["write"] },
  { agentId: "example-research", resourceId: "browser", actions: ["read"] },
];

type ModelDecision = { resourceId: "notes"|"browser"; action: "write"|"read"; input: unknown };

async function decideWithModel(goal:string):Promise<ModelDecision>{
  const key=process.env.OPENAI_API_KEY;
  if(!key) throw new Error("OPENAI_API_KEY is not configured.");
  const response=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${key}`},
    body:JSON.stringify({model:process.env.NODRA_AGENT_MODEL??"gpt-5-mini",input:`You are the Research agent inside a controlled Nodra laboratory. Choose exactly one safe sandbox action for this goal: ${goal}. Return JSON only with resourceId browser|notes, action read|write, and input object.`})
  });
  if(!response.ok) throw new Error(`Model request failed: ${response.status}`);
  const data=await response.json() as any;
  const text=String(data.output_text??data.output?.flatMap((x:any)=>x.content??[]).map((x:any)=>x.text??"").join("")??"");
  const parsed=JSON.parse(text) as ModelDecision;
  if(!["browser","notes"].includes(parsed.resourceId)||!["read","write"].includes(parsed.action)) throw new Error("Model returned an invalid sandbox action.");
  return parsed;
}

export function createProtectedResearchAgent(observer: GatewayObserver, resolveAgentState?: AgentStateResolver) {
  const gateway = createObservableGateway(rules, observer, {}, resolveAgentState);
  gateway.register("notes", async (input) => ({ saved: true, input }));
  gateway.register("browser", async (input) => ({ fetched: true, input }));
  return {
    async act(resourceId: string, action: string, input: unknown) {
      return gateway.execute({ id: crypto.randomUUID(), agentId: "example-research", resourceId, action }, input);
    },
    async actFromGoal(goal:string){
      const decision=await decideWithModel(goal);
      return gateway.execute({id:crypto.randomUUID(),agentId:"example-research",resourceId:decision.resourceId,action:decision.action},decision.input);
    }
  };
}
