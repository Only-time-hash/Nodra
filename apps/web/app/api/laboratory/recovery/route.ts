import { NextResponse } from "next/server";
import { buildRecoveryPlan } from "@nodra/recovery";
import { getWorkspaceContext } from "../../../../lib/persistence";

export async function POST(request:Request) {
  const ctx=await getWorkspaceContext();
  if(!ctx) return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
  const {incidentId}=await request.json().catch(()=>({incidentId:null}));
  if(!incidentId) return NextResponse.json({error:"incidentId_required"},{status:400});
  const plan=buildRecoveryPlan(incidentId,[
    {id:"memory-1",agentId:"research",kind:"memory-write",target:"research-notes",reversibility:"reversible"},
    {id:"credential-1",agentId:"research",kind:"credential-use",target:"sandbox-browser-session",reversibility:"human-review"}
  ]);
  const {data:row,error}=await ctx.supabase.from("recovery_plans").upsert({workspace_id:ctx.workspaceId,incident_id:incidentId,safe_to_restart:false},{onConflict:"incident_id"}).select("id").single();
  if(error||!row) return NextResponse.json({error:"recovery_persistence_failed"},{status:500});
  await ctx.supabase.from("recovery_steps").delete().eq("recovery_plan_id",row.id);
  await ctx.supabase.from("recovery_steps").insert(plan.steps.map(step=>({workspace_id:ctx.workspaceId,recovery_plan_id:row.id,title:step.title,reason:step.reason,requires_human:step.requiresHuman,status:step.status})));
  await ctx.supabase.from("incidents").update({state:"recovering"}).eq("id",incidentId);
  return NextResponse.json({...plan,persisted:true});
}
