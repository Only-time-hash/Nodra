import { NextResponse } from "next/server";
import { buildRecoveryPlan } from "@nodra/recovery";
import { getWorkspaceContext } from "../../../../lib/persistence";

export async function POST(request:Request) {
  const ctx=await getWorkspaceContext();
  if(!ctx) return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
  if(!["owner","admin","analyst"].includes(ctx.role)) return NextResponse.json({error:"insufficient_role"},{status:403});
  const {incidentId}=await request.json().catch(()=>({incidentId:null}));
  if(!incidentId) return NextResponse.json({error:"incidentId_required"},{status:400});
  const {data:incident}=await ctx.supabase.from("incidents").select("id,state").eq("id",incidentId).eq("workspace_id",ctx.workspaceId).maybeSingle();
  if(!incident) return NextResponse.json({error:"incident_not_found"},{status:404});
  if(incident.state!=="contained"&&incident.state!=="recovering") return NextResponse.json({error:"containment_required_before_recovery"},{status:409});

  const [{data:events},{data:actions}]=await Promise.all([
    ctx.supabase.from("security_events").select("id,agent_id,event_type,action,payload").eq("incident_id",incidentId),
    ctx.supabase.from("containment_actions").select("id,target_ref,action_type").eq("incident_id",incidentId)
  ]);
  const affected:any[]=[];
  for(const e of events??[]){
    if(e.event_type==="untrusted-content") affected.push({id:e.id,agentId:e.agent_id,kind:"memory-write",target:"research-state",reversibility:"human-review"});
    const payloadResource=e.payload && typeof e.payload === "object" && !Array.isArray(e.payload) ? e.payload.resource : undefined;
    if(e.event_type==="policy-decision"&&payloadResource) affected.push({id:e.id,agentId:e.agent_id,kind:"credential-use",target:String(payloadResource),reversibility:"human-review"});
  }
  for(const a of actions??[]) if(a.action_type==="restrict_authority") affected.push({id:a.id,agentId:a.target_ref,kind:"scheduled-job",target:`${a.target_ref} delegated work`,reversibility:"human-review"});
  const plan=buildRecoveryPlan(incidentId,affected);

  const checks={originPatched:false,credentialsRotated:false,memoryReviewed:false,pendingJobsReviewed:false,humanApproved:false};
  const {data:row,error}=await ctx.supabase.from("recovery_plans").upsert({workspace_id:ctx.workspaceId,incident_id:incidentId,safe_to_restart:false,restart_checks:checks},{onConflict:"incident_id"}).select("id").single();
  if(error||!row) return NextResponse.json({error:"recovery_persistence_failed"},{status:500});
  await ctx.supabase.from("recovery_steps").delete().eq("recovery_plan_id",row.id);
  const unique=Array.from(new Map(plan.steps.map(s=>[s.title,s])).values());
  if(unique.length) await ctx.supabase.from("recovery_steps").insert(unique.map(step=>({workspace_id:ctx.workspaceId,recovery_plan_id:row.id,title:step.title,reason:step.reason,requires_human:step.requiresHuman,status:step.status})));
  await ctx.supabase.from("incidents").update({state:"recovering"}).eq("id",incidentId);
  return NextResponse.json({...plan,steps:unique,restartChecks:checks,persisted:true});
}
