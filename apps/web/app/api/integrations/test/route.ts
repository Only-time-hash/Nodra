import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

export async function POST(request:Request){
 const ctx=await getWorkspaceContext();if(!ctx)return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"invalid_request"},{status:400})}
 if(typeof body?.agentId!=="string")return NextResponse.json({error:"agent_id_required"},{status:400});
 const {data:agent}=await ctx.supabase.from("agents").select("id,external_id,name,status").eq("workspace_id",ctx.workspaceId).eq("external_id",body.agentId).maybeSingle();
 if(!agent)return NextResponse.json({error:"unknown_agent"},{status:404});
 const {data:event}=await ctx.supabase.from("security_events").select("id,occurred_at,decision").eq("workspace_id",ctx.workspaceId).eq("agent_id",agent.id).order("occurred_at",{ascending:false}).limit(1).maybeSingle();
 return NextResponse.json({connected:Boolean(event),agent,lastEvent:event??null,message:event?"Signed runtime traffic received.":"Agent registered; waiting for its first signed runtime event."});
}
