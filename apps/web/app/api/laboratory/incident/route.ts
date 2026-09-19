import { NextResponse } from "next/server";
import { simulateIncident, fiveAgentScenario } from "../../../../lib/laboratory";
import { ensureLabAgents } from "../../../../lib/persistence";

export async function POST() {
  const ctx=await ensureLabAgents();
  if(!ctx) return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
  const simulated=simulateIncident();
  const research=ctx.agents.get("research"), manager=ctx.agents.get("manager"), finance=ctx.agents.get("finance"), data=ctx.agents.get("data"), support=ctx.agents.get("support");
  if(!research||!manager||!finance||!data||!support) return NextResponse.json({error:"laboratory_agents_missing"},{status:500});

  const {data:incident,error}=await ctx.supabase.from("incidents").insert({
    workspace_id:ctx.workspaceId,origin_agent_id:research,title:"Laboratory authority propagation",severity:"high",metadata:{source:"nodra-v0.1-lab",scenario:"five-agent-selective-containment"}
  }).select("id").single();
  if(error||!incident) return NextResponse.json({error:"incident_persistence_failed"},{status:500});

  const records=[
    {agent_id:research,event_type:"untrusted-content",action:"read",decision:"allow",payload:{source:"sandbox-browser",observable:true}},
    {agent_id:research,event_type:"delegation-influence",action:"influence",decision:"allow",payload:{to:"manager",observable:true}},
    {agent_id:manager,event_type:"task-delegation",action:"delegate",decision:"allow",payload:{to:"finance",observable:true}},
    {agent_id:manager,event_type:"task-delegation",action:"delegate",decision:"allow",payload:{to:"data",observable:true}},
    {agent_id:research,event_type:"policy-decision",action:"request",decision:simulated.attemptedAction.decision,payload:{resource:"payments",reason:simulated.attemptedAction.reason,observable:true}}
  ];
  const ids:string[]=[];
  for(const rec of records){
    const {data:e,error:eerr}=await ctx.supabase.rpc("append_security_event",{
      p_workspace_id:ctx.workspaceId,p_incident_id:incident.id,p_agent_id:rec.agent_id,p_event_type:rec.event_type,
      p_action:rec.action,p_decision:rec.decision,p_payload:rec.payload
    });
    if(eerr||!e) {\n      console.error("[Nodra] append_security_event failed", {\n        incidentId: incident.id,\n        eventType: rec.event_type,\n        code: eerr?.code ?? null,\n        message: eerr?.message ?? "RPC returned no event",\n        details: eerr?.details ?? null,\n        hint: eerr?.hint ?? null\n      });\n      return NextResponse.json({error:"evidence_persistence_failed"},{status:500});\n    }
    ids.push(e.id);
  }

  const {error:edgeError}=await ctx.supabase.from("causal_edges").insert([
    {workspace_id:ctx.workspaceId,incident_id:incident.id,from_agent_id:research,to_agent_id:manager,event_id:ids[1],relation:"influenced"},
    {workspace_id:ctx.workspaceId,incident_id:incident.id,from_agent_id:manager,to_agent_id:finance,event_id:ids[2],relation:"delegated"},
    {workspace_id:ctx.workspaceId,incident_id:incident.id,from_agent_id:manager,to_agent_id:data,event_id:ids[3],relation:"delegated"}
  ]);
  if(edgeError) return NextResponse.json({error:"causal_graph_persistence_failed"},{status:500});

  const {data:radius,error:radiusError}=await ctx.supabase.rpc("incident_blast_radius",{p_incident_id:incident.id});
  if(radiusError) return NextResponse.json({error:"blast_radius_failed"},{status:500});
  const affectedAgentIds=(radius??[]).sort((a:any,b:any)=>a.depth-b.depth).map((x:any)=>x.external_id);
  const expectedAffected=[...fiveAgentScenario.expectedContained].sort();
  const actualAffected=[...affectedAgentIds].sort();
  const scenarioVerified=JSON.stringify(actualAffected)===JSON.stringify(expectedAffected) && !affectedAgentIds.includes("support");
  await ctx.supabase.from("incident_affected_entities").insert((radius??[]).map((x:any)=>({
    incident_id:incident.id,workspace_id:ctx.workspaceId,entity_type:"agent",entity_ref:x.external_id,status:x.depth===0?"origin":"affected"
  })));

  return NextResponse.json({attemptedAction:simulated.attemptedAction,affectedAgentIds,expectedHealthy:fiveAgentScenario.expectedHealthy,scenarioVerified,incidentId:incident.id,persisted:true,evidenceEventIds:ids});
}
