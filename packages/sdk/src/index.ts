import { createHmac, randomUUID } from "node:crypto";
export type NodraDecision="allow"|"deny"|"require-approval";
export type NodraEvent={id?:string;agentId:string;resourceId:string;action:string;decision:NodraDecision;phase?:"intent"|"result";executed?:boolean;outcome?:string;reason?:string;causedBy?:string;causedByEventId?:string;incidentId?:string;occurredAt?:string};
export class Nodra {
 constructor(private config:{baseUrl:string;signingSecret:string;workspaceId:string}){}
 protect(agent:{id:string;name?:string}){return {record:(event:Omit<NodraEvent,"agentId">)=>this.record({...event,agentId:agent.id})}}
 async record(event:NodraEvent){const body=JSON.stringify({...event,id:event.id??randomUUID()});const timestamp=Math.floor(Date.now()/1000).toString(),nonce=randomUUID();const key=createHmac("sha256",this.config.signingSecret).update("nodra:"+this.config.workspaceId+":"+event.agentId).digest();const signature=createHmac("sha256",key).update(timestamp+"."+nonce+"."+body).digest("hex");const res=await fetch(new URL("/api/gateway/events",this.config.baseUrl),{method:"POST",headers:{"content-type":"application/json","x-nodra-timestamp":timestamp,"x-nodra-nonce":nonce,"x-nodra-signature":signature},body});if(!res.ok)throw new Error("Nodra gateway rejected event ("+res.status+")");return res.json()}
}