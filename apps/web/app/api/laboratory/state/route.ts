import { NextResponse } from "next/server";
import { ensureLabAgents } from "../../../../lib/persistence";

export async function GET() {
  const ctx=await ensureLabAgents();
  if(!ctx) return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
  const [{data:agents},{data:incidents},{data:events}] = await Promise.all([
    ctx.supabase.from("agents").select("external_id,name,status").eq("workspace_id",ctx.workspaceId).eq("kind","laboratory"),
    ctx.supabase.from("incidents").select("id,state,title,severity,opened_at,contained_at,resolved_at").eq("workspace_id",ctx.workspaceId).order("opened_at",{ascending:false}).limit(1),
    ctx.supabase.from("security_events").select("id,event_type,action,decision,payload,sequence_no,occurred_at,event_hash").eq("workspace_id",ctx.workspaceId).order("sequence_no",{ascending:true}).limit(100)
  ]);
  const incident=incidents?.[0]??null;
  let causalEdges:any[]=[]; let affected:any[]=[];
  if(incident){
    const [{data:edges},{data:radius}]=await Promise.all([
      ctx.supabase.from("causal_edges").select("relation,from:agents!causal_edges_from_agent_id_fkey(external_id),to:agents!causal_edges_to_agent_id_fkey(external_id),event_id").eq("incident_id",incident.id),
      ctx.supabase.rpc("incident_blast_radius",{p_incident_id:incident.id})
    ]);
    causalEdges=edges??[]; affected=radius??[];
  }
  let recovery=null;
  if(incident){
    const {data:plan}=await ctx.supabase.from("recovery_plans").select("id,safe_to_restart,restart_checks,approved_by,approved_at").eq("incident_id",incident.id).maybeSingle();
    if(plan){ const {data:steps}=await ctx.supabase.from("recovery_steps").select("id,title,reason,requires_human,status,completed_at").eq("recovery_plan_id",plan.id).order("id"); recovery={...plan,steps:steps??[]}; }
  }
  return NextResponse.json({agents:agents??[],incident,events:events??[],causalEdges,affected,recovery});
}
