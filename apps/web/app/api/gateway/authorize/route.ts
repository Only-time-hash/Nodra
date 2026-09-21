import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";
import { verifyGatewayRequest } from "../../../../lib/gateway-signing";
import { checkRateLimit } from "../../../../lib/rate-limit";

export async function POST(request:Request){
 const ctx=await getWorkspaceContext();
 if(!ctx)return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 const raw=await request.text();
 if(Buffer.byteLength(raw,"utf8")>32768)return NextResponse.json({error:"authorization_request_too_large"},{status:413});
 let body:any;try{body=JSON.parse(raw)}catch{return NextResponse.json({error:"invalid_authorization_request"},{status:400})}
 if(!body||typeof body.agentId!=="string"||typeof body.resourceId!=="string"||typeof body.action!=="string")return NextResponse.json({error:"invalid_authorization_request"},{status:400});
 const {data:agent}=await ctx.supabase.from("agents").select("id,external_id,status,authority_scope").eq("workspace_id",ctx.workspaceId).eq("external_id",body.agentId).maybeSingle();
 if(!agent?.id)return NextResponse.json({error:"unknown_agent"},{status:404});
 const secret=process.env.NODRA_GATEWAY_SIGNING_SECRET;if(!secret)return NextResponse.json({error:"gateway_signing_not_configured"},{status:503});
 const verified=verifyGatewayRequest(raw,{timestamp:request.headers.get("x-nodra-timestamp"),nonce:request.headers.get("x-nodra-nonce"),signature:request.headers.get("x-nodra-signature")},{workspaceId:ctx.workspaceId,agentId:agent.id,masterSecret:secret});
 if(!verified.valid)return NextResponse.json({error:verified.reason},{status:401});
 const rate=checkRateLimit("gateway-authorize:"+ctx.workspaceId+":"+agent.id,240,60000);
 if(!rate.allowed)return NextResponse.json({error:"authorization_rate_limit_exceeded"},{status:429,headers:{"Retry-After":String(rate.retryAfterSeconds)}});
 const scope=agent.authority_scope;
 const allowed=Array.isArray(scope)?scope.map(String):scope&&typeof scope==="object"?Object.keys(scope).filter(k=>Boolean((scope as any)[k])):[];
 const healthy=agent.status==="healthy";
 const scoped=allowed.includes("*")||allowed.includes(body.action)||allowed.includes(body.resourceId)||allowed.includes(body.resourceId+":"+body.action);
 const decision=!healthy?"deny":scoped?"allow":"require-approval";
 const reason=!healthy?"agent_not_healthy":scoped?"authority_scope_allows":"outside_explicit_authority";
 return NextResponse.json({decision,reason,agentId:agent.external_id,resourceId:body.resourceId,action:body.action});
}
