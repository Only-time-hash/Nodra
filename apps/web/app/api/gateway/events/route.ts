import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

const decisions=new Set(["allow","deny","require-approval"]);

export async function POST(request:Request){
 const ctx=await getWorkspaceContext();
 if(!ctx) return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 const body=await request.json().catch(()=>null);
 if(!body?.id||!body?.agentId||!body?.resourceId||!body?.action||!decisions.has(body?.decision)) return NextResponse.json({error:"invalid_gateway_event"},{status:400});
 const {data:agent}=await ctx.supabase.from("agents").select("id").eq("workspace_id",ctx.workspaceId).eq("external_id",body.agentId).maybeSingle();
 const {data,error}=await ctx.supabase.rpc("append_security_event",{
   p_workspace_id:ctx.workspaceId,p_incident_id:null,p_agent_id:agent?.id??null,
   p_event_type:"gateway-tool-request",p_action:body.action,p_resource_id:null,p_decision:body.decision,
   p_caused_by:body.causedBy??null,p_payload:{gatewayRequestId:body.id,resourceId:body.resourceId,executed:Boolean(body.executed),reason:body.reason??null,observedAt:body.occurredAt??null}
 });
 if(error) return NextResponse.json({error:"gateway_event_persistence_failed"},{status:500});
 return NextResponse.json({recorded:true,eventId:data?.id??null});
}
