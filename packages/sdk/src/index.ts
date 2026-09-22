import { createHash, createHmac, randomUUID } from "node:crypto";

export type NodraDecision="allow"|"deny"|"require-approval";
export type NodraEvent={id?:string;agentId:string;resourceId:string;action:string;decision:NodraDecision;phase?:"intent"|"result";executed?:boolean;outcome?:string;reason?:string;causedBy?:string;causedByEventId?:string;incidentId?:string;occurredAt?:string};

type Config={baseUrl:string;credential:string;workspaceId:string};
function sign(body:string,config:Config,agentId:string){
 if(config.credential.length<32)throw new Error("Nodra credential must contain at least 32 characters.");
 const timestamp=String(Math.floor(Date.now()/1000)),nonce=randomUUID();
 const bodyDigest=createHash("sha256").update(body).digest("hex");
 const canonical="v1
"+timestamp+"
"+nonce+"
"+bodyDigest;
 const digest=createHmac("sha256",config.credential).update(canonical).digest("hex");
 return {"x-nodra-credential":config.credential,"x-nodra-timestamp":timestamp,"x-nodra-nonce":nonce,"x-nodra-signature":"v1="+digest};
}

export class Nodra {
 private config:Config;
 constructor(config:Config){this.config=config;}
 protect(agent:{id:string;name?:string}){
  return {
   authorize:(request:{resourceId:string;action:string})=>this.authorize({agentId:agent.id,...request}),
   executeApproved:(request:{resourceId:string;action:string;authorizationEventId:string;executionToken:string})=>this.executeApproved({agentId:agent.id,...request}),
   record:(event:Omit<NodraEvent,"agentId">)=>this.record({...event,agentId:agent.id}),
   intent:(event:Omit<NodraEvent,"agentId"|"phase"|"executed">)=>this.record({...event,agentId:agent.id,phase:"intent",executed:false}),
   result:(event:Omit<NodraEvent,"agentId"|"phase">)=>this.record({...event,agentId:agent.id,phase:"result"})
  };
 }
 async authorize(request:{agentId:string;resourceId:string;action:string}){
  const body=JSON.stringify(request),headers=sign(body,this.config,request.agentId);
  const res=await fetch(new URL("/api/gateway/authorize",this.config.baseUrl),{method:"POST",headers:{"content-type":"application/json",...headers},body});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(String(data?.error??("Nodra authorization failed ("+res.status+")")));
  return data as {decision:NodraDecision;reason:string;agentId:string;resourceId:string;action:string};
 }
 async executeApproved(request:{agentId:string;resourceId:string;action:string;authorizationEventId:string;executionToken:string}){
  const body=JSON.stringify(request),headers=sign(body,this.config,request.agentId);
  const res=await fetch(new URL("/api/gateway/execute-approved",this.config.baseUrl),{method:"POST",headers:{"content-type":"application/json",...headers},body});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(String(data?.error??("Nodra approved execution failed ("+res.status+")")));
  return data as {decision:"allow";reason:"human_approval_consumed";authorizationEventId:string;agentId:string;resourceId:string;action:string};
 }
 async record(event:NodraEvent){
  const payload={...event,id:event.id??randomUUID()};
  const body=JSON.stringify(payload),headers=sign(body,this.config,event.agentId);
  const res=await fetch(new URL("/api/gateway/events",this.config.baseUrl),{method:"POST",headers:{"content-type":"application/json",...headers},body});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(String(data?.error??("Nodra gateway rejected event ("+res.status+")")));
  return data;
 }
}

export {protectTool,mcpGuard,openAIGuard,langChainGuard,crewAIGuard,restGuard} from "./adapters.ts";
