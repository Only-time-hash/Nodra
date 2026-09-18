import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

const keys=["originPatched","credentialsRotated","memoryReviewed","pendingJobsReviewed","humanApproved"] as const;

export async function POST(request:Request){
  const ctx=await getWorkspaceContext();
  if(!ctx) return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
  const body=await request.json().catch(()=>null);
  if(!body?.incidentId) return NextResponse.json({error:"incidentId_required"},{status:400});
  const {data:plan}=await ctx.supabase.from("recovery_plans").select("id,restart_checks").eq("incident_id",body.incidentId).eq("workspace_id",ctx.workspaceId).maybeSingle();
  if(!plan) return NextResponse.json({error:"recovery_plan_not_found"},{status:404});
  const checks={...(plan.restart_checks??{})};
  for(const key of keys) if(typeof body.checks?.[key]==="boolean") checks[key]=body.checks[key];
  if(body.checks?.humanApproved===true && !["owner","admin"].includes(ctx.role)) return NextResponse.json({error:"owner_or_admin_approval_required"},{status:403});
  const humanApproved=checks.humanApproved===true;
  await ctx.supabase.from("recovery_plans").update({restart_checks:checks,approved_by:humanApproved?ctx.userId:null,approved_at:humanApproved?new Date().toISOString():null}).eq("id",plan.id);
  const {data:safe,error}=await ctx.supabase.rpc("assess_incident_restart",{p_incident_id:body.incidentId});
  if(error) return NextResponse.json({error:"restart_assessment_failed"},{status:500});
  if(safe){
    await ctx.supabase.from("incidents").update({state:"resolved",resolved_at:new Date().toISOString()}).eq("id",body.incidentId);
    await ctx.supabase.from("agents").update({status:"healthy",authority_scope:{recovery_verified:true}}).eq("workspace_id",ctx.workspaceId).eq("kind","laboratory");
  }
  return NextResponse.json({incidentId:body.incidentId,restartChecks:checks,safeToRestart:Boolean(safe),state:safe?"resolved":"recovering"});
}
