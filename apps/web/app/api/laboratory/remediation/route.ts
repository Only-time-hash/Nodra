import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

// Legacy evidence-only writes are deliberately disabled. Recovery checks are
// security decisions and may only be advanced by the atomic remediation
// adapter, which performs the action and records its evidence together.
export async function POST(){
  const ctx=await getWorkspaceContext();
  if(!ctx) return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
  return NextResponse.json(
    {error:"evidence_only_remediation_disabled",use:"/api/laboratory/remediate"},
    {status:410},
  );
}
