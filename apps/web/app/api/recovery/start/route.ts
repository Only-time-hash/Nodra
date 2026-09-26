import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });
  if (!["owner", "admin", "analyst"].includes(ctx.role)) {
    return NextResponse.json({ error: "insufficient_role" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.incidentId !== "string") {
    return NextResponse.json({ error: "incidentId_required" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase.rpc("start_customer_recovery", {
    p_incident_id: body.incidentId,
  });

  if (error) {
    const message = String(error.message || "");
    if (message.includes("incident_not_found")) return NextResponse.json({ error: "incident_not_found" }, { status: 404 });
    if (message.includes("containment_required_before_recovery")) return NextResponse.json({ error: "containment_required_before_recovery" }, { status: 409 });
    if (message.includes("insufficient_role")) return NextResponse.json({ error: "insufficient_role" }, { status: 403 });
    return NextResponse.json({ error: "recovery_start_failed" }, { status: 500 });
  }

  return NextResponse.json(data ?? { incidentId: body.incidentId, state: "recovering" });
}
