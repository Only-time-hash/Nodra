import { createProtectedResearchAgent } from "../../../../lib/protected-agent-example";
import { createFlightRecorderObserver } from "../../../../lib/gateway-observer";
import { getWorkspaceContext } from "../../../../lib/persistence";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });

  // Agent identity is server-owned. Never accept caller-supplied identity headers.
  const claimedAgent = request.headers.get("x-nodra-agent-id") || request.headers.get("x-agent-id");
  if (claimedAgent && claimedAgent.toLowerCase() !== "research") {
    return NextResponse.json({ error: "agent_identity_mismatch" }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return NextResponse.json({ error: "request_too_large" }, { status: 413 });
  }
  const rawBody = await request.text().catch(() => "");
  if (Buffer.byteLength(rawBody, "utf8") > 16_384) {
    return NextResponse.json({ error: "request_too_large" }, { status: 413 });
  }
  let body: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {
    body = null;
  }
  if (!body) {
    return NextResponse.json({ error: "invalid_request_body" }, { status: 400 });
  }
  if (body.goal !== undefined && typeof body.goal !== "string") {
    return NextResponse.json({ error: "invalid_goal" }, { status: 400 });
  }
  if (body.goal && String(body.goal).length > 4_096) {
    return NextResponse.json({ error: "goal_too_large" }, { status: 413 });
  }
  if (!body.goal && (!body.resourceId || !body.action)) {
    return NextResponse.json({ error: "goal_or_resourceId_and_action_required" }, { status: 400 });
  }
  if (!body.goal && (typeof body.resourceId !== "string" || typeof body.action !== "string")) {
    return NextResponse.json({ error: "invalid_resource_or_action" }, { status: 400 });
  }
  if (!body.goal && (body.resourceId.length > 64 || body.action.length > 64)) {
    return NextResponse.json({ error: "invalid_resource_or_action" }, { status: 400 });
  }
  if (!body.goal && !((body.resourceId === "browser" && body.action === "read") || (body.resourceId === "notes" && body.action === "write"))) {
    return NextResponse.json({ error: "tool_action_not_allowed" }, { status: 403 });
  }

  const resolveAgentState = async (externalId: string) => {
    const { data, error } = await ctx.supabase
      .from("agents")
      .select("status")
      .eq("workspace_id", ctx.workspaceId)
      .eq("external_id", externalId)
      .maybeSingle();

    if (error || !data?.status) return "quarantined" as const; // fail closed if containment state cannot be established
    if (data.status === "quarantined") return "quarantined" as const;
    if (data.status === "at_risk") return "at-risk" as const;
    if (data.status === "healthy") return "healthy" as const;
    return "quarantined" as const; // paused/offline agents must not execute tools
  };

  // This route runs on the server, where a root-relative fetch target has no browser
  // origin to resolve against. Resolve the recorder endpoint from the incoming request
  // and forward only the authenticated session cookie to the same-origin recorder route.
  const recorderEndpoint = new URL("/api/gateway/events", request.url).toString();
  const signingSecret = process.env.NODRA_GATEWAY_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json({ error: "gateway_signing_not_configured" }, { status: 503 });
  }
  const { data: signingAgent } = await ctx.supabase
    .from("agents")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("external_id", "research")
    .maybeSingle();
  if (!signingAgent?.id) {
    return NextResponse.json({ error: "gateway_agent_linkage_failed" }, { status: 409 });
  }
  const agent = createProtectedResearchAgent(
    createFlightRecorderObserver({
      endpoint: recorderEndpoint,
      cookie: request.headers.get("cookie"),
      signingIdentity: {
        workspaceId: ctx.workspaceId,
        agentId: signingAgent.id,
        masterSecret: signingSecret,
      },
    }),
    resolveAgentState,
  );
  try {
    const result = body.goal
      ? await agent.actFromGoal(String(body.goal))
      : await agent.act(String(body.resourceId), String(body.action), body.input ?? {});
    return NextResponse.json(result, {
      status: result.event.decision === "deny" ? 403 : result.event.decision === "require-approval" ? 202 : 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("[Nodra] protected agent execution failed", { message });
    const category =
      message.includes("GEMINI_API_KEY") || message.includes("OPENAI_API_KEY") ? "model_not_configured" :
      message.includes("Gemini request failed") || message.includes("OpenAI request failed") || message.includes("Model provider request timed out") ? "model_provider_request_failed" :
      message.includes("invalid sandbox action") || message.includes("no decision") ? "model_response_invalid" :
      message.includes("flight recorder") ? "flight_recorder_failed" :
      "protected_agent_execution_failed";
    return NextResponse.json({ error: category }, { status: 500 });
  }
}
