import {NextResponse} from "next/server";
import {getWorkspaceContext} from "../../../lib/persistence";
export async function GET(request:Request){
 const ctx=await getWorkspaceContext();if(!ctx)return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 const url=new URL(request.url),decision=url.searchParams.get("decision"),agent=url.searchParams.get("agent"),limit=Math.min(Math.max(Number(url.searchParams.get("limit")||50),1),100);
 let q=ctx.supabase.from("security_events").select("id,event_type,action,decision,occurred_at,recorded_at,sequence_no,agent_id,resource_id,incident_id,payload,agents!security_events_agent_id_fkey(external_id,name),resources!security_events_resource_id_fkey(external_id,name)").eq("workspace_id",ctx.workspaceId).order("sequence_no",{ascending:false}).limit(limit);
 if(decision&&["allow","deny","require_approval"].includes(decision))q=q.eq("decision",decision as "allow"|"deny"|"require_approval");
 if(agent)q=q.eq("agent_id",agent);
 const {data,error}=await q;if(error)return NextResponse.json({error:"activity_query_failed"},{status:500});
 return NextResponse.json({events:data??[]});
}