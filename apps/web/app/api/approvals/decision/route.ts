import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });
  if (!["owner", "admin", "analyst"].includes(ctx.role)) {
    return NextResponse.json({ error: "insufficient_role" }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_approval_decision" }, { status: 400 });
  }

  if (
    typeof body?.eventId !== "string" ||
    !["approved", "denied"].includes(body?.decision) ||
    typeof body?.reason !== "string" ||
    body.reason.trim().length < 3 ||
    body.reason.length > 500
  ) {
    return NextResponse.json({ error: "invalid_approval_decision" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase.rpc("decide_approval", {
    p_event_id: body.eventId,
    p_decision: body.decision,
    p_reason: body.reason.trim(),
  });

  if (error) {
    const message = String(error.message || "");
    if (message.includes("approval_event_not_found")) {
      return NextResponse.json({ error: "approval_event_not_found" }, { status: 404 });
    }
    if (message.includes("insufficient_role")) {
      return NextResponse.json({ error: "insufficient_role" }, { status: 403 });
    }
    if (message.includes("duplicate key") || error.code === "23505") {
      return NextResponse.json({ error: "approval_already_decided" }, { status: 409 });
    }
    return NextResponse.json({ error: "approval_decision_failed" }, { status: 500 });
  }

  const decision = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    decision,
    runtimeContinuation: body.decision === "approved"
      ? "The protected runtime can now claim this approval automatically."
      : "The protected runtime will receive the denial.",
  });
}
