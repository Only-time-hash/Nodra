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
  const {data:integrityRows,error:integrityError}=await ctx.supabase.rpc("verify_security_event_chain",{p_workspace_id:ctx.workspaceId});
  const integrity=integrityError ? {valid:false,checkedEvents:0,firstBadSequence:null,reason:"verification_unavailable"} : (()=>{ const row=integrityRows?.[0]; return {valid:Boolean(row?.valid),checkedEvents:Number(row?.checked_events??0),firstBadSequence:row?.first_bad_sequence??null,reason:row?.reason??null}; })();
  let causalEdges:any[]=[]; let affected:any[]=[];
  if(incident){
    const [{data:edges},{data:radius}]=await Promise.all([
      ctx.supabase.from("causal_edges").select("relation,from:agents!causal_edges_from_agent_id_fkey(external_id),to:agents!causal_edges_to_agent_id_fkey(external_id),event_id").eq("incident_id",incident.id),
      ctx.supabase.rpc("incident_blast_radius",{p_incident_id:incident.id})
    ]);
    causalEdges=edges??[]; affected=radius??[];
  }
  let containmentActions:any[]=[];
  if(incident){ const {data:actions}=await ctx.supabase.from("containment_actions").select("id,action,target_type,target_id,reason,created_at").eq("incident_id",incident.id).order("created_at",{ascending:true}); containmentActions=actions??[]; }
  let recovery=null;
  if(incident){
    const {data:plan}=await ctx.supabase.from("recovery_plans").select("id,safe_to_restart,restart_checks,approved_by,approved_at").eq("incident_id",incident.id).maybeSingle();
    if(plan){ const {data:steps}=await ctx.supabase.from("recovery_steps").select("id,title,reason,requires_human,status,completed_at").eq("recovery_plan_id",plan.id).order("id"); recovery={...plan,steps:steps??[]}; }
  }
  const incidentEvents=incident ? (events??[]).filter((event:any)=>causalEdges.some((edge:any)=>edge.event_id===event.id) || event.payload?.incident_id===incident.id || event.event_type==="untrusted-content" || event.event_type==="policy-decision") : [];
  let remediationActions:any[]=[]; let remediationEvidence:any[]=[];
  if(incident){
    const [{data:ra},{data:re}]=await Promise.all([
      ctx.supabase.from("remediation_actions").select("id,action_type,target,status,started_at,completed_at,result").eq("incident_id",incident.id).order("started_at",{ascending:true}),
      ctx.supabase.from("remediation_evidence").select("id,check_key,evidence_type,evidence_ref,source,verified_at,adapter_action_id").eq("incident_id",incident.id).order("verified_at",{ascending:true})
    ]);
    remediationActions=ra??[]; remediationEvidence=re??[];
  }
  const forensicTimeline=[...incidentEvents.map((event:any)=>({kind:"evidence",id:event.id,at:event.occurred_at,label:event.event_type,detail:event.action??event.decision??"recorded event",sequence:event.sequence_no,hash:event.event_hash})),...containmentActions.map((action:any)=>({kind:"containment",id:action.id,at:action.created_at,label:action.action,detail:action.reason,target:action.target_id})),...remediationActions.map((action:any)=>({kind:"remediation",id:action.id,at:action.completed_at??action.started_at,label:action.action_type,detail:action.status,target:action.target})),...remediationEvidence.map((e:any)=>({kind:"evidence",id:e.id,at:e.verified_at,label:e.check_key,detail:e.evidence_type,target:e.evidence_ref}))].sort((a:any,b:any)=>String(a.at).localeCompare(String(b.at)));
  return NextResponse.json({agents:agents??[],incident,events:events??[],causalEdges,affected,containmentActions,remediationActions,remediationEvidence,forensicTimeline,recovery,integrity});
}
