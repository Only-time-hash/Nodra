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

  // Mutate the controlled laboratory state first. Evidence is recorded only after
  // the simulated resource actually reflects the remediation action.
  const { data: labState, error: stateError } = await ctx.supabase.rpc("apply_laboratory_remediation_state", {
    p_workspace_id: ctx.workspaceId,
    p_action_type: body.actionType,
  });
  if (stateError || !labState) {
    return NextResponse.json({ error: "laboratory_state_remediation_failed" }, { status: 409 });
  }

  const { data, error } = await ctx.supabase.rpc("run_laboratory_remediation", {
    p_incident_id: body.incidentId,
    p_action_type: body.actionType,
    p_target: body.target ?? "laboratory",
  });

  if (error || !data) {
    return NextResponse.json({ error: "remediation_failed" }, { status: 409 });
  }

  const { error: syncError } = await ctx.supabase.rpc("sync_recovery_steps_for_incident", {
    p_incident_id: body.incidentId,
    p_action_type: body.actionType,
  });
  if (syncError) return NextResponse.json({ error: "recovery_step_sync_failed" }, { status: 500 });

  const result = data as { actionId?: string; checkKey?: string; restartChecks?: Record<string, boolean> };
  const { data: safe } = await ctx.supabase.rpc("assess_incident_restart", { p_incident_id: body.incidentId });

  return NextResponse.json({
    actionId: result.actionId,
    status: "succeeded",
    checkKey: result.checkKey,
    restartChecks: result.restartChecks ?? {},
    safeToRestart: Boolean(safe),
    laboratoryState: labState,
  });
}
