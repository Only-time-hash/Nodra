import { NextResponse } from "next/server";
import { containLaboratoryIncident } from "../../../../lib/laboratory";
import { getWorkspaceContext } from "../../../../lib/persistence";

export async function POST(request:Request) {
  const ctx=await getWorkspaceContext();
  if(!ctx) return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
  const {incidentId}=await request.json().catch(()=>({incidentId:null}));
  if(!incidentId) return NextResponse.json({error:"incidentId_required"},{status:400});
  const result=containLaboratoryIncident();
  const {data:incident}=await ctx.supabase.from("incidents").select("id").eq("id",incidentId).eq("workspace_id",ctx.workspaceId).maybeSingle();
  if(!incident) return NextResponse.json({error:"incident_not_found"},{status:404});
  const {error}=await ctx.supabase.from("containment_actions").insert({workspace_id:ctx.workspaceId,incident_id:incidentId,action_type:"quarantine_branch",target_type:"agent",target_ref:"research",requested_by:ctx.userId,reason:"Contain laboratory incident while preserving healthy peers",result});
  if(error) return NextResponse.json({error:"containment_persistence_failed"},{status:500});
  await ctx.supabase.from("incidents").update({state:"contained",contained_at:new Date().toISOString()}).eq("id",incidentId);
  return NextResponse.json({...result,incidentId,persisted:true});
}
