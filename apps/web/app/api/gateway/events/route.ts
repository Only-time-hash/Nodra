import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

const decisions = new Set(["allow", "deny", "require-approval"]);

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.id || !body?.agentId || !body?.resourceId || !body?.action || !decisions.has(body?.decision)) {
    return NextResponse.json({ error: "invalid_gateway_event" }, { status: 400 });
  }

  const { data: agent } = await ctx.supabase
    .from("agents")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("external_id", body.agentId)
    .maybeSingle();

  let incidentId: string | null = body.incidentId ?? null;
  const suspicious = body.decision === "deny" || body.decision === "require-approval";

  if (suspicious && agent?.id && !incidentId) {
    const { data: existing } = await ctx.supabase
      .from("incidents")
      .select("id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("origin_agent_id", agent.id)
      .in("state", ["open", "contained", "recovering"])
      .contains("metadata", { source: "runtime-gateway" })
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    incidentId = existing?.id ?? null;

    if (!incidentId) {
      const { data: created, error: incidentError } = await ctx.supabase
        .from("incidents")
        .insert({
          workspace_id: ctx.workspaceId,
          origin_agent_id: agent.id,
          title: `Gateway policy ${body.decision}: ${body.action}`,
          severity: body.decision === "deny" ? "high" : "medium",
          metadata: {
            source: "runtime-gateway",
            triggerRequestId: body.id,
            resourceId: body.resourceId,
            triggerDecision: body.decision,
          },
        })
        .select("id")
        .single();

      if (incidentError || !created) {
        return NextResponse.json({ error: "gateway_incident_creation_failed" }, { status: 500 });
      }
      incidentId = created.id;
    }
  }

  if (body.phase === "intent") {
    const { error: outboxError } = await ctx.supabase.rpc("record_gateway_intent", {
      p_workspace_id: ctx.workspaceId,
      p_incident_id: incidentId,
      p_agent_id: agent?.id ?? null,
      p_request_id: body.id,
      p_payload: body,
    });
    if (outboxError) return NextResponse.json({ error: "gateway_intent_not_durable" }, { status: 503 });
  }

  const { data, error } = await ctx.supabase.rpc("append_security_event", {
    p_workspace_id: ctx.workspaceId,
    p_incident_id: incidentId,
    p_agent_id: agent?.id ?? null,
    p_event_type: "gateway-tool-request",
    p_action: body.action,
    p_resource_id: null,
    p_decision: body.decision,
    p_caused_by: body.causedBy ?? null,
    p_payload: {
      gatewayRequestId: body.id,
      phase: body.phase ?? "result",
      outcome: body.outcome ?? null,
      resourceId: body.resourceId,
      executed: Boolean(body.executed),
      reason: body.reason ?? null,
      observedAt: body.occurredAt ?? null,
    },
  });

  if (error) return NextResponse.json({ error: "gateway_event_persistence_failed" }, { status: 500 });

  // Persist observable agent-to-agent causality when causedBy identifies a known agent.
  // Unknown/external causes remain on the event but never create fabricated graph edges.
  if (body.causedBy && agent?.id) {
    const { data: parentAgent } = await ctx.supabase
      .from("agents")
      .select("id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("external_id", body.causedBy)
      .maybeSingle();

    if (parentAgent?.id && parentAgent.id !== agent.id) {
      const { error: edgeError } = await ctx.supabase.from("causal_edges").insert({
        workspace_id: ctx.workspaceId,
        incident_id: incidentId,
        from_agent_id: parentAgent.id,
        to_agent_id: agent.id,
        event_id: data?.id ?? null,
        relation: "gateway-caused-by",
      });
      if (edgeError) return NextResponse.json({ error: "gateway_causal_edge_persistence_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ recorded: true, eventId: data?.id ?? null, incidentId });
}
