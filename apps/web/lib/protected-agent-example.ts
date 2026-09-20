import { createObservableGateway, type GatewayObserver } from "@nodra/runtime";

type AgentStateResolver = (agentId:string)=>Promise<"healthy"|"at-risk"|"restricted"|"quarantined">|"healthy"|"at-risk"|"restricted"|"quarantined";
type ModelDecision = { resourceId: "notes"|"browser"; action: "write"|"read"; input: unknown };
type ModelProvider = "gemini"|"openai";

const rules = [
  { agentId: "research", resourceId: "notes", actions: ["write"] },
  { agentId: "research", resourceId: "browser", actions: ["read"] },
];

function isPlainObject(value:unknown):value is Record<string,unknown>{
  return typeof value==="object" && value!==null && !Array.isArray(value) && Object.getPrototypeOf(value)===Object.prototype;
}

function parseDecision(text:string):ModelDecision{
  if(text.length>16384) throw new Error("Model returned an invalid sandbox action.");
  const cleaned=text.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim();
  let parsed: ModelDecision;
  try {
    parsed=JSON.parse(cleaned) as ModelDecision;
  } catch {
    throw new Error("Model returned an invalid sandbox action.");
  }
  if(!isPlainObject(parsed)) throw new Error("Model returned an invalid sandbox action.");
  const valid=(parsed.resourceId==="browser"&&parsed.action==="read")||(parsed.resourceId==="notes"&&parsed.action==="write");
  if(!valid || !isPlainObject(parsed.input)) throw new Error("Model returned an invalid sandbox action.");
  const keys=Object.keys(parsed.input);
  if(keys.length>12) throw new Error("Model returned an invalid sandbox action.");
  const serialized=JSON.stringify(parsed.input);
  if(serialized.length>8192) throw new Error("Model returned an invalid sandbox action.");
  return parsed;
}

const instruction=(goal:string)=>`You are the Research agent inside a controlled Nodra laboratory. Choose exactly one safe sandbox action for this goal: ${goal}. Return JSON only: {"resourceId":"browser"|"notes","action":"read"|"write","input":{}}. browser must use read; notes must use write.`;

async function fetchWithTimeout(url:string, init:RequestInit, timeoutMs=15000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try { return await fetch(url,{...init,signal:controller.signal}); }
  catch(error){
    if(error instanceof Error && error.name==="AbortError") throw new Error("Model provider request timed out.");
    throw error;
  }
  finally { clearTimeout(timer); }
}

async function decideWithGemini(goal:string):Promise<ModelDecision>{
  const key=process.env.GEMINI_API_KEY;
  if(!key) throw new Error("GEMINI_API_KEY is not configured.");
  const model=process.env.NODRA_AGENT_MODEL??"gemini-2.5-flash";
  const response=await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
    method:"POST",headers:{"content-type":"application/json","x-goog-api-key":key},
    body:JSON.stringify({contents:[{parts:[{text:instruction(goal)}]}],generationConfig:{responseMimeType:"application/json"}})
  });
  if(!response.ok) throw new Error(`Gemini request failed: ${response.status}`);
  const data=await response.json() as any;
  const text=String(data.candidates?.[0]?.content?.parts?.map((p:any)=>p.text??"").join("")??"");
  if(!text) throw new Error("Gemini returned no decision.");
  return parseDecision(text);
}

async function decideWithOpenAI(goal:string):Promise<ModelDecision>{
  const key=process.env.OPENAI_API_KEY;
  if(!key) throw new Error("OPENAI_API_KEY is not configured.");
  const response=await fetchWithTimeout("https://api.openai.com/v1/responses",{
    method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${key}`},
    body:JSON.stringify({model:process.env.NODRA_AGENT_MODEL??"gpt-5-mini",input:instruction(goal)})
  });
  if(!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const data=await response.json() as any;
  const text=String(data.output_text??data.output?.flatMap((x:any)=>x.content??[]).map((x:any)=>x.text??"").join("")??"");
  return parseDecision(text);
}

async function decideWithModel(goal:string):Promise<ModelDecision>{
  const provider=(process.env.NODRA_MODEL_PROVIDER??"gemini").toLowerCase() as ModelProvider;
  if(provider==="gemini") return decideWithGemini(goal);
  if(provider==="openai") return decideWithOpenAI(goal);
  throw new Error(`Unsupported NODRA_MODEL_PROVIDER: ${provider}`);
}

export function createProtectedResearchAgent(observer: GatewayObserver, resolveAgentState?: AgentStateResolver) {
  const gateway = createObservableGateway(rules, observer, {}, resolveAgentState);
  gateway.register("notes", async (input) => ({ saved: true, input }));
  gateway.register("browser", async (input) => ({ fetched: true, input }));
  return {
    async act(resourceId: string, action: string, input: unknown) {
      return gateway.execute({ id: crypto.randomUUID(), agentId: "research", resourceId, action }, input);
    },
    async actFromGoal(goal:string){
      const decision=await decideWithModel(goal);
      return gateway.execute({id:crypto.randomUUID(),agentId:"research",resourceId:decision.resourceId,action:decision.action},decision.input);
    }
  };
}
