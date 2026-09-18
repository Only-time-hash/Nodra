import { NextResponse } from "next/server";
import { simulateIncident } from "../../../../lib/laboratory";
import { ensureLabAgents, eventHash } from "../../../../lib/persistence";

export async function POST() {
  const ctx=await ensureLabAgents();
  if(!ctx) return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
  const simulated=simulateIncident();
  const research=ctx.agents.get("research"), manager=ctx.agents.get("manager"), finance=ctx.agents.get("finance");
  if(!research||!manager||!finance) return NextResponse.json({error:"laboratory_agents_missing"},{status:500});

  const {data:incident,error}=await ctx.supabase.from("incidents").insert({
    workspace_id:ctx.workspaceId,origin_agent_id:research,title:"Laboratory authority propagation",severity:"high",metadata:{source:"nodra-v0.1-lab"}
  }).select("id").single();
  if(error||!incident) return NextResponse.json({error:"incident_persistence_failed"},{status:500});

  const {data:previous}=await ctx.supabase.from("security_events").select("sequence_no,event_hash").eq("workspace_id",ctx.workspaceId).order("sequence_no",{ascending:false}).limit(1).maybeSingle();
  let sequence=Number(previous?.sequence_no??0); let prevHash=previous?.event_hash??null;
  const records=[
    {agent_id:research,event_type:"untrusted-content",action:"read",decision:"allow",payload:{source:"sandbox-browser",observable:true}},
    {agent_id:research,event_type:"delegation-influence",action:"influence",decision:"allow",payload:{to:"manager",observable:true}},
    {agent_id:manager,event_type:"task-delegation",action:"delegate",decision:"allow",payload:{to:"finance",observable:true}},
    {agent_id:research,event_type:"policy-decision",action:"request",decision:simulated.attemptedAction.decision,payload:{resource:"payments",reason:simulated.attemptedAction.reason,observable:true}}
  ];
  const ids:string[]=[];
  for(const rec of records){
    sequence+=1;
    const base={workspace_id:ctx.workspaceId,incident_id:incident.id,...rec,sequence_no:sequence,prev_hash:prevHash};
    const event_hash=eventHash(base);
    const {data:e,error:eerr}=await ctx.supabase.from("security_events").insert({...base,event_hash}).select("id").single();
    if(eerr||!e) return NextResponse.json({error:"evidence_persistence_failed"},{status:500});
    ids.push(e.id); prevHash=event_hash;
  }

  const {error:edgeError}=await ctx.supabase.from("causal_edges").insert([
    {workspace_id:ctx.workspaceId,incident_id:incident.id,from_agent_id:research,to_agent_id:manager,event_id:ids[1],relation:"influenced"},
    {workspace_id:ctx.workspaceId,incident_id:incident.id,from_agent_id:manager,to_agent_id:finance,event_id:ids[2],relation:"delegated"}
  ]);
  if(edgeError) return NextResponse.json({error:"causal_graph_persistence_failed"},{status:500});

  const {data:radius,error:radiusError}=await ctx.supabase.rpc("incident_blast_radius",{p_incident_id:incident.id});
  if(radiusError) return NextResponse.json({error:"blast_radius_failed"},{status:500});
  const affectedAgentIds=(radius??[]).sort((a:any,b:any)=>a.depth-b.depth).map((x:any)=>x.external_id);
  await ctx.supabase.from("incident_affected_entities").insert((radius??[]).map((x:any)=>({
    incident_id:incident.id,workspace_id:ctx.workspaceId,entity_type:"agent",entity_ref:x.external_id,status:x.depth===0?"origin":"affected"
  })));

  return NextResponse.json({attemptedAction:simulated.attemptedAction,affectedAgentIds,incidentId:incident.id,persisted:true,evidenceEventIds:ids});
}
