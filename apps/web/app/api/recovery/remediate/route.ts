import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";
import { issueIntegrationSecret } from "../../../../lib/integration-credentials";

const actions = new Set([
  "verify_origin_remediated",
  "rotate_credentials",
  "review_memory",
  "cancel_pending_jobs",
]);

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });
  if (!["owner", "admin", "analyst"].includes(ctx.role)) {
    return NextResponse.json({ error: "insufficient_role" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.incidentId !== "string" || !actions.has(body?.actionType)) {
    return NextResponse.json({ error: "valid_incident_and_action_required" }, { status: 400 });
  }

  if (body.actionType === "rotate_credentials" && !["owner", "admin"].includes(ctx.role)) {
    return NextResponse.json({ error: "owner_or_admin_required_for_rotation" }, { status: 403 });
  }

  const issued = body.actionType === "rotate_credentials" ? issueIntegrationSecret() : null;

  const { data, error } = await ctx.supabase.rpc("run_customer_recovery_action", {
    p_incident_id: body.incidentId,
    p_action_type: body.actionType,
    p_evidence_note: typeof body.evidenceNote === "string" ? body.evidenceNote.trim() : undefined,
    p_secret_hash: issued?.hash,
    p_secret_prefix: issued?.prefix,
  });

  if (error) {
    const message = String(error.message || "");
    if (message.includes("incident_not_recovering")) return NextResponse.json({ error: "incident_not_recovering" }, { status: 409 });
    if (message.includes("recovery_plan_not_found")) return NextResponse.json({ error: "recovery_plan_not_found" }, { status: 404 });
    if (message.includes("evidence_note_required")) return NextResponse.json({ error: "evidence_note_required" }, { status: 400 });
    if (message.includes("owner_or_admin_required_for_rotation")) return NextResponse.json({ error: "owner_or_admin_required_for_rotation" }, { status: 403 });
    if (message.includes("insufficient_role")) return NextResponse.json({ error: "insufficient_role" }, { status: 403 });
    return NextResponse.json({ error: "recovery_action_failed" }, { status: 500 });
  }

  const result =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};

  return NextResponse.json({
    ...result,
    ...(issued
      ? {
          secret: issued.secret,
          warning:
            "Store this recovery credential now and update the origin runtime. Nodra will not return the plaintext secret again.",
        }
      : {}),
  });
}
