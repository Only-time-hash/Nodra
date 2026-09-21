import {NextResponse} from "next/server";
import {authenticateIntegrationRequest} from "../../../../lib/integration-auth";
import {GATEWAY_SIGNATURE_MAX_AGE_SECONDS} from "../../../../lib/gateway-signing";
import {checkRateLimit} from "../../../../lib/rate-limit";

export async function POST(request:Request){
 const raw=await request.text();
 if(Buffer.byteLength(raw,"utf8")>32768)return NextResponse.json({error:"authorization_request_too_large"},{status:413});
 let body:any;try{body=JSON.parse(raw)}catch{return NextResponse.json({error:"invalid_authorization_request"},{status:400})}
 if(!body||typeof body.agentId!=="string"||typeof body.resourceId!=="string"||typeof body.action!=="string"||body.agentId.length>128||body.resourceId.length>128||body.action.length>128)return NextResponse.json({error:"invalid_authorization_request"},{status:400});
 const auth=await authenticateIntegrationRequest(request,raw,body.agentId);
 if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
 const {error:nonceError}=await auth.admin.from("gateway_request_nonces").insert({workspace_id:auth.workspaceId,agent_id:auth.agentId,nonce:auth.verified.nonce,request_timestamp:new Date(auth.verified.timestamp*1000).toISOString(),expires_at:new Date((auth.verified.timestamp+GATEWAY_SIGNATURE_MAX_AGE_SECONDS)*1000).toISOString()});
 if(nonceError)return NextResponse.json({error:nonceError.code==="23505"?"gateway_request_replayed":"gateway_replay_protection_unavailable"},{status:nonceError.code==="23505"?409:503});
 const local=checkRateLimit("gateway-authorize:"+auth.workspaceId+":"+auth.agentId,240,60000);
 if(!local.allowed)return NextResponse.json({error:"authorization_rate_limit_exceeded"},{status:429,headers:{"Retry-After":String(local.retryAfterSeconds)}});
 const {data:rateRows,error:rateError}=await auth.admin.rpc("consume_gateway_rate_limit",{p_workspace_id:auth.workspaceId,p_agent_id:auth.agentId});
 if(rateError)return NextResponse.json({error:"gateway_rate_limit_unavailable"},{status:503});
 const rate=Array.isArray(rateRows)?rateRows[0]:rateRows;
 if(!rate?.allowed)return NextResponse.json({error:"authorization_rate_limit_exceeded"},{status:429,headers:{"Retry-After":String(Math.max(1,Number(rate?.retry_after_seconds??1)))}});
 const scope=auth.agent.authority_scope;
 const allowed=Array.isArray(scope)?scope.map(String):scope&&typeof scope==="object"?Object.keys(scope).filter(k=>Boolean(scope[k])):[];
 const healthy=auth.agent.status==="healthy";
 const scoped=allowed.includes("*")||allowed.includes(body.action)||allowed.includes(body.resourceId)||allowed.includes(body.resourceId+":"+body.action);
 const decision=!healthy?"deny":scoped?"allow":"require-approval";
 const reason=!healthy?"agent_not_healthy":scoped?"authority_scope_allows":"outside_explicit_authority";
 const {error:evidenceError}=await auth.admin.rpc("append_security_event",{p_workspace_id:auth.workspaceId,p_incident_id:null,p_agent_id:auth.agentId,p_event_type:"gateway-authorization",p_action:body.action,p_resource_id:null,p_decision:decision==="require-approval"?"require_approval":decision,p_caused_by_event_id:null,p_payload:{resourceId:body.resourceId,reason,credentialId:auth.credentialId}});
 if(evidenceError)return NextResponse.json({error:"authorization_evidence_unavailable"},{status:503});
 return NextResponse.json({decision,reason,agentId:auth.agent.external_id,resourceId:body.resourceId,action:body.action});
}
