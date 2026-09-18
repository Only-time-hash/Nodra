import { NextResponse } from "next/server";
import { ensureLabAgents } from "../../../../lib/persistence";

export async function GET() {
  const ctx=await ensureLabAgents();
  if(!ctx) return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
  const [{data:agents},{data:incidents},{data:events}] = await Promise.all([
    ctx.supabase.from("agents").select("external_id,name,status").eq("workspace_id",ctx.workspaceId).eq("kind","laboratory"),
    ctx.supabase.from("incidents").select("id,state,title,severity,opened_at,contained_at").eq("workspace_id",ctx.workspaceId).order("opened_at",{ascending:false}).limit(1),
    ctx.supabase.from("security_events").select("id,event_type,action,decision,payload,sequence_no,occurred_at,event_hash").eq("workspace_id",ctx.workspaceId).order("sequence_no",{ascending:true}).limit(100)
  ]);
  return NextResponse.json({agents:agents??[],incident:incidents?.[0]??null,events:events??[]});
}
