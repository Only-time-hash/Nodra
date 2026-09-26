import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

const MODEL = process.env.NODRA_GEMINI_MODEL || "gemini-3.8-flash";

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });

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

  const evidence = JSON.stringify({ incident, events: events ?? [] }).slice(0, 120000);
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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
      cache: "no-store",
    },
  );

  const providerBody = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json({
      error: "ai_provider_request_failed",
      providerStatus: response.status,
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
