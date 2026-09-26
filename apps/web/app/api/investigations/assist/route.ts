import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

const PRIMARY_MODEL = process.env.NODRA_GEMINI_MODEL || "gemini-3.8-flash";
const FALLBACK_MODELS = (process.env.NODRA_GEMINI_FALLBACK_MODELS || "gemini-3.5-flash-lite,gemini-3.5-flash")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const MODEL_CHAIN = [PRIMARY_MODEL, ...FALLBACK_MODELS.filter((model) => model !== PRIMARY_MODEL)];
const SENSITIVE_KEY = /(secret|token|password|credential|authorization|cookie|api[_-]?key|private[_-]?key|session)/i;

function redactForExternalAi(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForExternalAi);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactForExternalAi(child),
      ]),
    );
  }
  if (typeof value === "string" && value.length > 2048) return value.slice(0, 2048) + "…";
  return value;
}

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });
  if (!["owner", "admin", "analyst"].includes(ctx.role)) {
    return NextResponse.json({ error: "insufficient_role" }, { status: 403 });
  }

  const { data: settings, error: settingsError } = await ctx.supabase
    .from("workspace_settings")
    .select("ai_config")
    .eq("workspace_id", ctx.workspaceId)
    .maybeSingle();

  if (settingsError) return NextResponse.json({ error: "settings_query_failed" }, { status: 500 });
  const aiConfig =
    settings?.ai_config && typeof settings.ai_config === "object" && !Array.isArray(settings.ai_config)
      ? (settings.ai_config as Record<string, unknown>)
      : {};

  if (!aiConfig.investigationAssist) {
    return NextResponse.json({ error: "ai_investigation_assistance_disabled" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.incidentId !== "string") {
    return NextResponse.json({ error: "incidentId_required" }, { status: 400 });
  }

  const [{ data: incident, error: incidentError }, { data: events, error: eventsError }] = await Promise.all([
    ctx.supabase
      .from("incidents")
      .select("id,title,severity,state,opened_at,contained_at,resolved_at,origin_agent_id,metadata,origin_agent:agents!incidents_origin_agent_id_fkey(id,external_id,name)")
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", body.incidentId)
      .maybeSingle(),
    ctx.supabase
      .from("security_events")
      .select("id,event_type,action,resource_id,decision,payload,occurred_at,agent_id,agent:agents!security_events_agent_id_fkey(id,external_id,name)")
      .eq("workspace_id", ctx.workspaceId)
      .eq("incident_id", body.incidentId)
      .order("occurred_at", { ascending: true })
      .limit(200),
  ]);

  if (incidentError || eventsError) return NextResponse.json({ error: "incident_evidence_query_failed" }, { status: 500 });
  if (!incident) return NextResponse.json({ error: "incident_not_found" }, { status: 404 });

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: "ai_provider_not_configured",
      provider: "gemini",
      model: PRIMARY_MODEL,
    }, { status: 503 });
  }

  const agentLabels = new Map<string, string>();
  const originAgent = Array.isArray((incident as any).origin_agent)
    ? (incident as any).origin_agent[0]
    : (incident as any).origin_agent;
  if (incident.origin_agent_id && originAgent) {
    agentLabels.set(
      String(incident.origin_agent_id),
      String(originAgent.name || originAgent.external_id || "Origin agent"),
    );
  }
  for (const event of events ?? []) {
    const relatedAgent = Array.isArray((event as any).agent) ? (event as any).agent[0] : (event as any).agent;
    if (event.agent_id && relatedAgent) {
      agentLabels.set(
        String(event.agent_id),
        String(relatedAgent.name || relatedAgent.external_id || "Agent"),
      );
    }
  }

  const safeIncident = {
    title: incident.title,
    severity: incident.severity,
    state: incident.state,
    openedAt: incident.opened_at,
    containedAt: incident.contained_at,
    resolvedAt: incident.resolved_at,
    originAgent: originAgent
      ? String(originAgent.name || originAgent.external_id || "Origin agent")
      : "Unknown agent",
    metadata: incident.metadata,
  };
  const safeEvents = (events ?? []).map((event: any) => {
    const relatedAgent = Array.isArray(event.agent) ? event.agent[0] : event.agent;
    return {
      eventType: event.event_type,
      action: event.action,
      resource: event.resource_id,
      decision: event.decision,
      payload: event.payload,
      occurredAt: event.occurred_at,
      agent: relatedAgent
        ? String(relatedAgent.name || relatedAgent.external_id || "Agent")
        : "Unknown agent",
    };
  });

  const evidence = JSON.stringify(
    redactForExternalAi({ incident: safeIncident, events: safeEvents }),
  ).slice(0, 120000);
  const prompt = [
    "You are Nodra's investigation assistant.",
    "Your job is to summarize evidence; you never make authorization, containment, recovery, or restart decisions.",
    "Use only the supplied incident and security-event evidence. Do not invent facts.",
    "Use the human-readable agent names supplied in the evidence. Never output database UUIDs or internal record identifiers.",
    "Whenever you refer to a named agent, preserve its exact display-name capitalization from the evidence.",
    "Clearly separate observed facts from hypotheses and unknowns.",
    "Return JSON with keys: summary, timeline, likelyCause, blastRadius, evidenceGaps, recommendedInvestigationSteps.",
    "timeline must be an array of objects with timestamp and event.",
    "evidenceGaps and recommendedInvestigationSteps must be arrays of concise strings.",
    "likelyCause must explicitly describe itself as a hypothesis when the evidence does not prove causation.",
    "recommendedInvestigationSteps must be investigative steps only, not autonomous remediation actions.",
    "",
    "EVIDENCE:",
    evidence,
  ].join("\n");

  const requestBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  let response: Response | null = null;
  let providerBody: any = null;
  let usedModel = PRIMARY_MODEL;
  let lastSafeReason = "provider_request_failed";
  let lastProviderStatus = 502;
  let lastProviderCode: string | null = null;

  for (const model of MODEL_CHAIN) {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: requestBody,
        cache: "no-store",
      });

      providerBody = await response.json().catch(() => null);
      if (response.ok) {
        usedModel = model;
        break;
      }

      const providerCode = String(providerBody?.error?.status ?? providerBody?.error?.code ?? "");
      const providerMessage = String(providerBody?.error?.message ?? "");
      const safeReason =
        response.status === 400 ? "invalid_provider_request" :
        response.status === 401 || response.status === 403 ? "provider_key_or_access_denied" :
        response.status === 429 ? "provider_quota_or_rate_limit" :
        response.status >= 500 ? "provider_temporarily_unavailable" :
        "provider_request_failed";

      lastSafeReason = safeReason;
      lastProviderStatus = response.status;
      lastProviderCode = providerCode || null;

      console.error("[Nodra] Gemini investigation request failed", {
        status: response.status,
        code: providerCode || null,
        model,
        reason: safeReason,
        message: providerMessage.slice(0, 300) || null,
      });

      const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
      if (!retryable || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }

    if (response?.ok) break;

    const shouldFallback =
      response &&
      [429, 500, 502, 503, 504].includes(response.status);

    if (!shouldFallback) break;
  }

  if (!response) {
    return NextResponse.json({ error: "ai_provider_unreachable" }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json({
      error: "ai_provider_request_failed",
      reason: lastSafeReason,
      providerStatus: lastProviderStatus,
      providerCode: lastProviderCode,
      attemptedModels: MODEL_CHAIN,
    }, { status: 502 });
  }

  const text = providerBody?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text ?? "").join("") ?? "";
  let analysis: any;
  try {
    analysis = JSON.parse(text);
  } catch {
    analysis = { summary: text, timeline: [], likelyCause: null, blastRadius: null, evidenceGaps: [], recommendedInvestigationSteps: [] };
  }

  const replaceKnownIds = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(replaceKnownIds);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, replaceKnownIds(child)]),
      );
    }
    if (typeof value !== "string") return value;
    let next = value;
    for (const [id, label] of agentLabels) next = next.split(id).join(label);
    next = next.split(String(incident.id)).join("this incident");
    next = next.replace(
      /\\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\b/gi,
      "internal reference",
    );
    return next;
  };

  const normalizeAgentNames = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalizeAgentNames);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, normalizeAgentNames(child)]),
      );
    }
    if (typeof value !== "string") return value;
    let next = value;
    const labels = [...new Set(agentLabels.values())].sort((a, b) => b.length - a.length);
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^$()|[\]\\]/g, "\\  const cleanAnalysis = replaceKnownIds(analysis);

  return NextResponse.json({
    incidentId: incident.id,
    provider: "gemini",
    model: usedModel,
    deterministicSecurityDecisionsUnaffected: true,
    analysis: cleanAnalysis,
  });");
      next = next.replace(new RegExp("\\b" + escaped + "\\b", "gi"), label);
    }
    return next;
  };

  const cleanAnalysis = normalizeAgentNames(replaceKnownIds(analysis));

  return NextResponse.json({
    deterministicSecurityDecisionsUnaffected: true,
    analysis: cleanAnalysis,
  });
}
