import { NextResponse } from "next/server";
import { simulateIncident } from "../../../../lib/laboratory";
import { ensureLabAgents, eventHash } from "../../../../lib/persistence";

export async function POST() {
  const ctx = await ensureLabAgents();
  if (!ctx) return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
  const result = simulateIncident();
  const originId = ctx.agents.get("research");
  const { data: incident, error } = await ctx.supabase.from("incidents").insert({
    workspace_id:ctx.workspaceId,origin_agent_id:originId,title:"Laboratory authority propagation",severity:"high",metadata:{source:"nodra-v0.1-lab"}
  }).select("id").single();
  if (error || !incident) return NextResponse.json({error:"incident_persistence_failed"},{status:500});

  const previous = await ctx.supabase.from("security_events").select("sequence_no,event_hash").eq("workspace_id",ctx.workspaceId).order("sequence_no",{ascending:false}).limit(1).maybeSingle();
  const sequence = Number(previous.data?.sequence_no ?? 0)+1;
  const base={workspace_id:ctx.workspaceId,incident_id:incident.id,agent_id:originId,event_type:"policy-decision",action:"request",decision:result.attemptedAction.decision,payload:{resource:"payments",reason:result.attemptedAction.reason},sequence_no:sequence,prev_hash:previous.data?.event_hash ?? null};
  const hash=eventHash(base);
  await ctx.supabase.from("security_events").insert({...base,event_hash:hash});
  return NextResponse.json({...result,incidentId:incident.id,persisted:true});
}
