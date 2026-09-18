import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

const allowed = new Set(["originPatched","credentialsRotated","memoryReviewed","pendingJobsReviewed"]);

export async function POST(request:Request){
  const ctx=await getWorkspaceContext();
  if(!ctx) return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
  if(!["owner","admin","analyst"].includes(ctx.role)) return NextResponse.json({error:"insufficient_role"},{status:403});
  const body=await request.json().catch(()=>null);
  if(!body?.incidentId||!allowed.has(body?.checkKey)||!body?.evidenceType||!body?.evidenceRef) return NextResponse.json({error:"valid_incident_check_and_evidence_required"},{status:400});
  const {data:incident}=await ctx.supabase.from("incidents").select("id").eq("id",body.incidentId).eq("workspace_id",ctx.workspaceId).maybeSingle();
  if(!incident) return NextResponse.json({error:"incident_not_found"},{status:404});
  const {error}=await ctx.supabase.from("remediation_evidence").insert({workspace_id:ctx.workspaceId,incident_id:body.incidentId,check_key:body.checkKey,evidence_type:body.evidenceType,evidence_ref:body.evidenceRef,details:body.details??{}});
  if(error) return NextResponse.json({error:"evidence_record_failed"},{status:500});
  const {data:checks,error:refreshError}=await ctx.supabase.rpc("refresh_recovery_evidence",{p_incident_id:body.incidentId});
  if(refreshError) return NextResponse.json({error:"evidence_refresh_failed"},{status:500});
  const {data:safe}=await ctx.supabase.rpc("assess_incident_restart",{p_incident_id:body.incidentId});
  return NextResponse.json({recorded:true,restartChecks:checks,safeToRestart:Boolean(safe)});
}
