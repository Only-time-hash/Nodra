import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });
  if (!["owner", "admin"].includes(ctx.role)) {
    return NextResponse.json({ error: "owner_or_admin_restart_required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.incidentId !== "string") {
    return NextResponse.json({ error: "incidentId_required" }, { status: 400 });
  }

  const { data: plan, error: planError } = await ctx.supabase
    .from("recovery_plans")
    .select("id,restart_checks")
    .eq("workspace_id", ctx.workspaceId)
    .eq("incident_id", body.incidentId)
    .maybeSingle();

  if (planError) return NextResponse.json({ error: "recovery_evidence_unavailable" }, { status: 503 });
  if (!plan) return NextResponse.json({ error: "recovery_plan_not_found" }, { status: 404 });

  const checks =
    plan.restart_checks && typeof plan.restart_checks === "object" && !Array.isArray(plan.restart_checks)
      ? { ...plan.restart_checks, humanApproved: true }
      : { humanApproved: true };

  const { error: approvalError } = await ctx.supabase
    .from("recovery_plans")
    .update({
      restart_checks: checks,
      approved_by: ctx.userId,
      approved_at: new Date().toISOString(),
    } as any)
    .eq("id", plan.id)
    .eq("workspace_id", ctx.workspaceId);

  if (approvalError) {
    return NextResponse.json({ error: "restart_approval_persist_failed" }, { status: 503 });
  }

  const { data: safe, error } = await ctx.supabase.rpc("complete_incident_restart", {
    p_incident_id: body.incidentId,
  });

  if (error) {
    const message = String(error.message || "");
    if (message.includes("owner_or_admin_restart_required")) {
      return NextResponse.json({ error: "owner_or_admin_restart_required" }, { status: 403 });
    }
    return NextResponse.json({ error: "restart_completion_failed" }, { status: 503 });
  }

  if (!safe) {
    return NextResponse.json(
      {
        error: "restart_requirements_not_satisfied",
        restartChecks: checks,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    incidentId: body.incidentId,
    restartChecks: checks,
    safeToRestart: true,
    state: "resolved",
  });
}
