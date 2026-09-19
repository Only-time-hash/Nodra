import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

const allowedActions = new Set(["patch_origin", "rotate_credentials", "review_memory", "cancel_pending_jobs"]);

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });
  if (!["owner", "admin", "analyst"].includes(ctx.role)) return NextResponse.json({ error: "insufficient_role" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.incidentId || !allowedActions.has(body?.actionType)) {
    return NextResponse.json({ error: "valid_incident_and_action_required" }, { status: 400 });
  }

  // One trusted database transaction now mutates laboratory state, records
  // remediation evidence, and synchronizes the matching recovery step.
  const { data, error } = await ctx.supabase.rpc("run_laboratory_remediation_atomic", {
    p_incident_id: body.incidentId,
    p_action_type: body.actionType,
    p_target: body.target ?? "laboratory",
  });
  if (error || !data) return NextResponse.json({ error: "remediation_failed" }, { status: 409 });

  const result = data as {
    actionId?: string;
    checkKey?: string;
    restartChecks?: Record<string, boolean>;
    laboratoryState?: unknown;
  };
  const { data: safe, error: assessmentError } = await ctx.supabase.rpc("assess_incident_restart", { p_incident_id: body.incidentId });
  if (assessmentError) return NextResponse.json({ error: "restart_assessment_failed" }, { status: 500 });

  return NextResponse.json({
    actionId: result.actionId,
    status: "succeeded",
    checkKey: result.checkKey,
    restartChecks: result.restartChecks ?? {},
    safeToRestart: Boolean(safe),
    laboratoryState: result.laboratoryState ?? null,
  });
}
