import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return NextResponse.json({error:"unauthorized"},{status:401});
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role,workspaces(id,name,slug)")
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({error:"workspace_lookup_failed"},{status:500});
  return NextResponse.json({workspace:data});
}
