import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

const MODEL = process.env.NODRA_GEMINI_MODEL || "gemini-3.8-flash";
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
      .select("id,title,severity,state,opened_at,contained_at,resolved_at,origin_agent_id,metadata")
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", body.incidentId)
      .maybeSingle(),
    ctx.supabase
      .from("security_events")
      .select("id,event_type,action,resource_id,decision,payload,occurred_at,agent_id")
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
      model: MODEL,
    }, { status: 503 });
  }

  const evidence = JSON.stringify(
    redactForExternalAi({ incident, events: events ?? [] }),
  ).slice(0, 120000);
  const prompt = [
    "You are Nodra's investigation assistant.",
    "Your job is to summarize evidence; you never make authorization, containment, recovery, or restart decisions.",
    "Use only the supplied incident and security-event evidence. Do not invent facts.",
    "Clearly separate observed facts from hypotheses and unknowns.",
    "Return concise JSON with keys: summary, timeline, likelyCause, blastRadius, evidenceGaps, recommendedInvestigationSteps.",
    "recommendedInvestigationSteps must be investigative steps only, not autonomous remediation actions.",
    "",
    "EVIDENCE:",
    evidence,
  ].join("\n");

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const requestBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: requestBody,
      cache: "no-store",
    });

    if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 2) break;
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }

  if (!response) {
    return NextResponse.json({ error: "ai_provider_unreachable" }, { status: 502 });
  }

  const providerBody = await response.json().catch(() => null);
  if (!response.ok) {
    const providerCode = String(providerBody?.error?.status ?? providerBody?.error?.code ?? "");
    const providerMessage = String(providerBody?.error?.message ?? "");
    const safeReason =
      response.status === 400 ? "invalid_provider_request" :
      response.status === 401 || response.status === 403 ? "provider_key_or_access_denied" :
      response.status === 429 ? "provider_quota_or_rate_limit" :
      response.status >= 500 ? "provider_temporarily_unavailable" :
      "provider_request_failed";

    console.error("[Nodra] Gemini investigation request failed", {
      status: response.status,
      code: providerCode || null,
      model: MODEL,
      reason: safeReason,
      message: providerMessage.slice(0, 300) || null,
    });

    return NextResponse.json({
      error: "ai_provider_request_failed",
      reason: safeReason,
      providerStatus: response.status,
      providerCode: providerCode || null,
    }, { status: 502 });
  }

  const text = providerBody?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text ?? "").join("") ?? "";
  let analysis: unknown;
  try {
    analysis = JSON.parse(text);
  } catch {
    analysis = { summary: text, timeline: [], likelyCause: null, blastRadius: null, evidenceGaps: [], recommendedInvestigationSteps: [] };
  }

  return NextResponse.json({
    incidentId: incident.id,
    provider: "gemini",
    model: MODEL,
    deterministicSecurityDecisionsUnaffected: true,
    analysis,
  });
}
