import { createProtectedResearchAgent } from "../../../../lib/protected-agent-example";
import { PostExecutionObservationError } from "@nodra/runtime";
import { createFlightRecorderObserver } from "../../../../lib/gateway-observer";
import { getWorkspaceContext } from "../../../../lib/persistence";
import { NextResponse } from "next/server";
import { checkRateLimit } from "../../../../lib/rate-limit";

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });

  // Best-effort per-workspace abuse/denial-of-wallet guard. Authorization remains
  // independent of this limiter. Distributed production deployments should add a
  // shared durable limiter in front of this process-local safety layer.
  const rate = checkRateLimit(`protected-agent:${ctx.workspaceId}`, 30, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", retryAfterSeconds: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

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
  let directResourceId: string | null = null;
  let directAction: string | null = null;
  if (!body.goal) {
    if (typeof body.resourceId !== "string" || typeof body.action !== "string") {
      return NextResponse.json({ error: "invalid_resource_or_action" }, { status: 400 });
    }
    directResourceId = body.resourceId;
    directAction = body.action;
    if (directResourceId.length > 64 || directAction.length > 64) {
      return NextResponse.json({ error: "invalid_resource_or_action" }, { status: 400 });
    }
    if (!((directResourceId === "browser" && directAction === "read") || (directResourceId === "notes" && directAction === "write"))) {
      return NextResponse.json({ error: "tool_action_not_allowed" }, { status: 403 });
    }
  }

  if (!body.goal) {
    const input = body.input ?? {};
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return NextResponse.json({ error: "invalid_tool_input" }, { status: 400 });
    }
    const inputRecord = input as Record<string, unknown>;
    if (Object.keys(inputRecord).length > 12) {
      return NextResponse.json({ error: "tool_input_too_complex" }, { status: 413 });
    }
    let serializedInput = "";
    try {
      serializedInput = JSON.stringify(inputRecord);
    } catch {
      return NextResponse.json({ error: "invalid_tool_input" }, { status: 400 });
    }
    if (Buffer.byteLength(serializedInput, "utf8") > 8_192) {
      return NextResponse.json({ error: "tool_input_too_large" }, { status: 413 });
    }
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
  // Consume the durable provider budget only after the request, capability,
  // signing configuration, and Research-agent linkage have all been validated.
  // Malformed/unauthorized requests therefore cannot starve valid provider work.
  const { data: durableRateRows, error: durableRateError } = await ctx.supabase.rpc("consume_protected_agent_rate_limit", {
    p_workspace_id: ctx.workspaceId,
  });
  if (durableRateError) {
    console.error("[Nodra] distributed protected-agent rate limit unavailable", {
      code: durableRateError.code ?? null,
      message: durableRateError.message ?? "unknown_error",
    });
    return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
  }
  const durableRate = Array.isArray(durableRateRows) ? durableRateRows[0] : durableRateRows;
  if (!durableRate?.allowed) {
    const retryAfterSeconds = Math.max(1, Number(durableRate?.retry_after_seconds ?? 1));
    console.warn("[Nodra] protected-agent quota exceeded", {
      event: "protected_agent_distributed_rate_limit_exceeded",
      workspaceId: ctx.workspaceId,
      retryAfterSeconds,
    });
    return NextResponse.json(
      { error: "rate_limit_exceeded", retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
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
      : await agent.act(directResourceId!, directAction!, body.input ?? {});
    return NextResponse.json(result, {
      status: result.event.decision === "deny" ? 403 : result.event.decision === "require-approval" ? 202 : 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    if (error instanceof PostExecutionObservationError) {
      console.error("[Nodra] protected agent result recording failed after execution", { requestId: error.requestId });
      return NextResponse.json({ error: "execution_result_recording_failed", executed: true, retrySafe: false, requestId: error.requestId }, { status: 503 });
    }
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
