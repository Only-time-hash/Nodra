import { createProtectedResearchAgent } from "../../../../lib/protected-agent-example";
import { createFlightRecorderObserver } from "../../../../lib/gateway-observer";
import { getWorkspaceContext } from "../../../../lib/persistence";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.goal && (!body?.resourceId || !body?.action)) {
    return NextResponse.json({ error: "goal_or_resourceId_and_action_required" }, { status: 400 });
  }

  const resolveAgentState = async (externalId: string) => {
    const { data, error } = await ctx.supabase
      .from("agents")
      .select("status")
      .eq("workspace_id", ctx.workspaceId)
      .eq("external_id", externalId)
      .maybeSingle();

    if (error || !data?.status) return "quarantined" as const; // fail closed if containment state cannot be established
    if (data.status === "quarantined" || data.status === "restricted" || data.status === "at-risk") return data.status;
    return "healthy" as const;
  };

  const agent = createProtectedResearchAgent(createFlightRecorderObserver(), resolveAgentState);
  try {
    const result = body.goal
      ? await agent.actFromGoal(String(body.goal))
      : await agent.act(String(body.resourceId), String(body.action), body.input ?? {});
    return NextResponse.json(result, {
      status: result.event.decision === "deny" ? 403 : result.event.decision === "require-approval" ? 202 : 200,
    });
  } catch {
    return NextResponse.json({ error: "protected_agent_execution_failed" }, { status: 500 });
  }
}
