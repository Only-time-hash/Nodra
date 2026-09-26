import {NextResponse} from "next/server";
import {getWorkspaceContext} from "../../../lib/persistence";

export async function GET(){
 const ctx=await getWorkspaceContext();
 if(!ctx)return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});

 const {data,error}=await (ctx.supabase as any).rpc("list_approval_requests",{p_workspace_id:ctx.workspaceId});
 if(error)return NextResponse.json({error:"approval_query_failed",detail:String(error.message||"")},{status:500});

 return NextResponse.json({
   approvals:(data??[]).map((row:any)=>({
     id:row.id,
     event_type:row.event_type,
     action:row.action,
     decision:row.decision,
     occurred_at:row.occurred_at,
     sequence_no:row.sequence_no,
     agent_id:row.agent_id,
     payload:row.payload,
     agents:{external_id:row.agent_external_id,name:row.agent_name},
     human_decision:row.human_decision?{
       decision:row.human_decision,
       reason:row.human_reason,
       decided_at:row.human_decided_at
     }:null
   }))
 });
}
