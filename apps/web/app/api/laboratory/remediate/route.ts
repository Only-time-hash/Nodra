import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

const map:any={patch_origin:"originPatched",rotate_credentials:"credentialsRotated",review_memory:"memoryReviewed",cancel_pending_jobs:"pendingJobsReviewed"};

export async function POST(request:Request){
 const ctx=await getWorkspaceContext(); if(!ctx) return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 if(!["owner","admin","analyst"].includes(ctx.role)) return NextResponse.json({error:"insufficient_role"},{status:403});
 const body=await request.json().catch(()=>null); const checkKey=map[body?.actionType];
 if(!body?.incidentId||!checkKey) return NextResponse.json({error:"valid_incident_and_action_required"},{status:400});
 const {data:incident}=await ctx.supabase.from("incidents").select("id,state").eq("id",body.incidentId).eq("workspace_id",ctx.workspaceId).maybeSingle();
 if(!incident||!["contained","recovering"].includes(incident.state)) return NextResponse.json({error:"contained_incident_required"},{status:409});
 const {data:action,error}=await ctx.supabase.from("remediation_actions").insert({workspace_id:ctx.workspaceId,incident_id:body.incidentId,action_type:body.actionType,target:body.target??"laboratory",status:"running",started_at:new Date().toISOString()}).select("id").single();
 if(error||!action) return NextResponse.json({error:"remediation_action_failed"},{status:500});
 // V0.1 adapter performs only deterministic sandbox remediation; real integrations must replace this branch.
 const result={adapter:"nodra-laboratory",verified:true,action:body.actionType,target:body.target??"laboratory"};
 const completedAt=new Date().toISOString();
 await ctx.supabase.from("remediation_actions").update({status:"succeeded",completed_at:completedAt,result}).eq("id",action.id);
 const {error:evidenceError}=await ctx.supabase.from("remediation_evidence").insert({workspace_id:ctx.workspaceId,incident_id:body.incidentId,check_key:checkKey,evidence_type:"adapter-success",evidence_ref:action.id,source:"nodra_adapter",adapter_action_id:action.id,details:result});
 if(evidenceError) return NextResponse.json({error:"remediation_evidence_failed"},{status:500});
 const {data:checks,error:refreshError}=await ctx.supabase.rpc("refresh_recovery_evidence",{p_incident_id:body.incidentId});
 if(refreshError) return NextResponse.json({error:"recovery_refresh_failed"},{status:500});
 const {data:safe}=await ctx.supabase.rpc("assess_incident_restart",{p_incident_id:body.incidentId});
 return NextResponse.json({actionId:action.id,status:"succeeded",checkKey,restartChecks:checks,safeToRestart:Boolean(safe)});
}
