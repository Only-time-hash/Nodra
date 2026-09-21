import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

export async function POST() {
  const ctx=await getWorkspaceContext();
  if(!ctx) return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
  if(!["owner","admin","analyst"].includes(ctx.role)) {
    return NextResponse.json({error:"insufficient_role"},{status:403});
  }
  const {data,error}=await ctx.supabase.rpc("reset_laboratory",{p_workspace_id:ctx.workspaceId});
  if(error) return NextResponse.json({error:"laboratory_reset_failed"},{status:error.message.includes("insufficient role")?403:500});
  return NextResponse.json(data);
}
