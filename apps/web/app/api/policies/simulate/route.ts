import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_policy_simulation_request" }, { status: 400 });
  }

  if (
    typeof body?.agentId !== "string" ||
    typeof body?.resourceId !== "string" ||
    typeof body?.action !== "string" ||
    !body.agentId ||
    !body.resourceId ||
    !body.action ||
    body.resourceId.length > 128 ||
    body.action.length > 128 ||
    (body.context !== undefined &&
      (!body.context || typeof body.context !== "object" || Array.isArray(body.context)))
  ) {
    return NextResponse.json({ error: "invalid_policy_simulation_request" }, { status: 400 });
  }

  const context = body.context ?? {};

  const { data, error } = await ctx.supabase.rpc("simulate_workspace_policy", {
    p_agent_id: body.agentId,
    p_resource_external_id: body.resourceId,
    p_action: body.action,
    p_context: context,
  });

  if (error) {
    const message = String(error.message || "");
    if (message.includes("agent_not_found")) {
      return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: "policy_simulation_failed" }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  const decision =
    row?.decision === "require_approval" ? "require-approval" : row?.decision;

  return NextResponse.json({
    decision,
    reason: row?.reason ?? "no_decision",
    matchedPolicyId: row?.matched_policy_id ?? null,
    baseDecision:
      row?.base_decision === "require_approval"
        ? "require-approval"
        : row?.base_decision ?? null,
    context,
  });
}
