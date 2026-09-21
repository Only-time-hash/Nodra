import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

const evidenceKeys=["originPatched","credentialsRotated","memoryReviewed","pendingJobsReviewed"] as const;

export async function POST(request:Request){
  const ctx=await getWorkspaceContext();
  if(!ctx) return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
  if(!["owner","admin"].includes(ctx.role)) return NextResponse.json({error:"owner_or_admin_restart_required"},{status:403});
  const body=await request.json().catch(()=>null);
  if(!body?.incidentId) return NextResponse.json({error:"incidentId_required"},{status:400});
  const {data:plan}=await ctx.supabase.from("recovery_plans").select("id,restart_checks").eq("incident_id",body.incidentId).eq("workspace_id",ctx.workspaceId).maybeSingle();
  if(!plan) return NextResponse.json({error:"recovery_plan_not_found"},{status:404});
  const {data:incident}=await ctx.supabase.from("incidents").select("id,state").eq("id",body.incidentId).eq("workspace_id",ctx.workspaceId).maybeSingle();
  if(!incident) return NextResponse.json({error:"incident_not_found"},{status:404});
  if(incident.state!=="recovering") return NextResponse.json({error:"incident_not_ready_for_restart"},{status:409});
  const checks = plan.restart_checks && typeof plan.restart_checks === "object" && !Array.isArray(plan.restart_checks)
    ? { ...plan.restart_checks }
    : {};
  if(evidenceKeys.some((key)=>typeof body.checks?.[key]==="boolean")) return NextResponse.json({error:"system_verified_checks_are_read_only"},{status:403});
  if(typeof body.checks?.humanApproved==="boolean") {
    checks.humanApproved=body.checks.humanApproved;
  }
  const {count:pendingSteps,error:stepsError}=await ctx.supabase.from("recovery_steps").select("id",{count:"exact",head:true}).eq("recovery_plan_id",plan.id).neq("status","ready");
  if(stepsError) return NextResponse.json({error:"recovery_evidence_unavailable"},{status:503});
  if((pendingSteps??0)>0 && body.checks?.humanApproved===true) return NextResponse.json({error:"remediation_steps_incomplete"},{status:409});
  const humanApproved=checks.humanApproved===true;
  const {error:approvalError}=await ctx.supabase.from("recovery_plans").update({restart_checks:checks,approved_by:humanApproved?ctx.userId:null,approved_at:humanApproved?new Date().toISOString():null}).eq("id",plan.id);
  if(approvalError) return NextResponse.json({error:"restart_approval_persist_failed"},{status:503});
  const {data:safe,error}=await ctx.supabase.rpc("assess_incident_restart",{p_incident_id:body.incidentId});
  if(error) return NextResponse.json({error:"restart_assessment_failed"},{status:500});
  if(safe && (pendingSteps??0)===0){
    const {error:incidentResolveError}=await ctx.supabase.from("incidents").update({state:"resolved",resolved_at:new Date().toISOString()}).eq("id",body.incidentId).eq("workspace_id",ctx.workspaceId);
    if(incidentResolveError) return NextResponse.json({error:"incident_resolution_failed"},{status:503});
    const {error:agentRestoreError}=await ctx.supabase.from("agents").update({status:"healthy"}).eq("workspace_id",ctx.workspaceId).eq("kind","laboratory");
    if(agentRestoreError) return NextResponse.json({error:"agent_restart_failed"},{status:503});
  }
  return NextResponse.json({incidentId:body.incidentId,restartChecks:checks,safeToRestart:Boolean(safe) && (pendingSteps??0)===0,state:safe && (pendingSteps??0)===0?"resolved":"recovering"});
}
