import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

export async function POST(request:Request) {
  const ctx=await getWorkspaceContext();
  if(!ctx) return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
  if(!["owner","admin","analyst"].includes(ctx.role)) return NextResponse.json({error:"insufficient_role"},{status:403});
  const {incidentId}=await request.json().catch(()=>({incidentId:null}));
  if(!incidentId) return NextResponse.json({error:"incidentId_required"},{status:400});

  const {data:incident}=await ctx.supabase.from("incidents").select("id,origin_agent_id,state").eq("id",incidentId).eq("workspace_id",ctx.workspaceId).maybeSingle();
  if(!incident) return NextResponse.json({error:"incident_not_found"},{status:404});

  const {data:scope,error:scopeError}=await ctx.supabase.rpc("containment_scope",{p_incident_id:incidentId});
  if(scopeError||!scope?.length) return NextResponse.json({error:"containment_scope_failed"},{status:500});

  const affectedIds=scope.map((x:any)=>x.agent_id);
  const origin=scope.find((x:any)=>x.action==="quarantine");
  const restricted=scope.filter((x:any)=>x.action==="restrict_authority");
  const originAgentId=incident.origin_agent_id;
  if(!originAgentId) return NextResponse.json({error:"incident_origin_missing"},{status:409});
  const {data:originAgent}=await ctx.supabase.from("agents").select("kind").eq("id",originAgentId).eq("workspace_id",ctx.workspaceId).maybeSingle();
  const agentKind=originAgent?.kind??"customer";
  const {data:allAgents}=await ctx.supabase.from("agents").select("id,external_id").eq("workspace_id",ctx.workspaceId).eq("kind",agentKind);
  const preserved=(allAgents??[]).filter((a:any)=>!affectedIds.includes(a.id)).map((a:any)=>a.external_id);

  if(origin) await ctx.supabase.from("agents").update({status:"quarantined",authority_scope:{contained:true,reason:"incident_origin"}}).eq("id",origin.agent_id);
  for(const target of restricted){
    await ctx.supabase.from("agents").update({status:"at_risk",authority_scope:{restricted:true,reason:"causal_descendant",incident_id:incidentId}}).eq("id",target.agent_id);
  }

  const actions=[
    ...(origin?[{workspace_id:ctx.workspaceId,incident_id:incidentId,action_type:"quarantine_agent",target_type:"agent",target_ref:origin.external_id,requested_by:ctx.userId,reason:"Incident origin identified by persisted causal evidence",result:{depth:origin.depth}}]:[]),
    ...restricted.map((x:any)=>({workspace_id:ctx.workspaceId,incident_id:incidentId,action_type:"restrict_authority",target_type:"agent",target_ref:x.external_id,requested_by:ctx.userId,reason:"Agent is reachable from incident origin through recorded causal edges",result:{depth:x.depth}}))
  ];
  const {error:actionError}=await ctx.supabase.from("containment_actions").insert(actions);
  if(actionError) return NextResponse.json({error:"containment_persistence_failed"},{status:500});

  await ctx.supabase.from("incidents").update({state:"contained",contained_at:new Date().toISOString()}).eq("id",incidentId);
  const targets=(allAgents??[]).map((a:any)=>({
    id:a.external_id,
    status:a.id===origin?.agent_id?"quarantined":affectedIds.includes(a.id)?"at-risk":"healthy",
    delegatedAuthority:!affectedIds.includes(a.id)
  }));
  return NextResponse.json({targets,revoked:scope.map((x:any)=>x.external_id),preserved,scope,incidentId,persisted:true});
}
