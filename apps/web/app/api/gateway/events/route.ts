import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { hashIntegrationSecret } from "../../../../lib/integration-credentials";
import { GATEWAY_SIGNATURE_MAX_AGE_SECONDS, verifyCredentialRequest } from "../../../../lib/gateway-signing";
import { checkRateLimit } from "../../../../lib/rate-limit";

const decisions = new Set(["allow", "deny", "require-approval"]);

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > 65_536) {
    return NextResponse.json({ error: "gateway_event_too_large" }, { status: 413 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 65_536) {
    return NextResponse.json({ error: "gateway_event_too_large" }, { status: 413 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_gateway_event" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof body.id !== "string" ||
    typeof body.agentId !== "string" ||
    typeof body.resourceId !== "string" ||
    typeof body.action !== "string" ||
    body.id.length > 128 ||
    body.agentId.length > 128 ||
    body.resourceId.length > 128 ||
    body.action.length > 128 ||
    !decisions.has(body.decision)
  ) {
    return NextResponse.json({ error: "invalid_gateway_event" }, { status: 400 });
  }

  const credential = request.headers.get("x-nodra-credential");
  if (!credential) {
    return NextResponse.json({ error: "credential_missing" }, { status: 401 });
  }

  const verified = verifyCredentialRequest(
    rawBody,
    {
      timestamp: request.headers.get("x-nodra-timestamp"),
      nonce: request.headers.get("x-nodra-nonce"),
      signature: request.headers.get("x-nodra-signature"),
    },
    credential,
  );

  if (!verified.valid) {
    return NextResponse.json({ error: verified.reason }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "integration_auth_not_configured" }, { status: 503 });
  }

  const local = checkRateLimit(
    "gateway-events:" + hashIntegrationSecret(credential).slice(0, 20),
    240,
    60_000,
  );

  if (!local.allowed) {
    return NextResponse.json(
      { error: "gateway_event_rate_limit_exceeded" },
      { status: 429, headers: { "Retry-After": String(local.retryAfterSeconds) } },
    );
  }

  const supabase = createClient<any>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.rpc("record_integration_gateway_event", {
    p_secret_hash: hashIntegrationSecret(credential),
    p_external_agent_id: body.agentId,
    p_nonce: verified.nonce,
    p_request_timestamp: new Date(verified.timestamp * 1000).toISOString(),
    p_expires_at: new Date(
      (verified.timestamp + GATEWAY_SIGNATURE_MAX_AGE_SECONDS) * 1000,
    ).toISOString(),
    p_request_id: body.id,
    p_resource_external_id: body.resourceId,
    p_action: body.action,
    p_decision: body.decision,
    p_phase: body.phase ?? "result",
    p_executed: Boolean(body.executed),
    p_outcome: body.outcome ?? null,
    p_reason: body.reason ?? null,
    p_caused_by: body.causedBy ?? null,
    p_caused_by_event_id: body.causedByEventId ?? null,
    p_incident_id: body.incidentId ?? null,
    p_occurred_at: body.occurredAt ?? new Date().toISOString(),
  });

  if (error) {
    const message = String(error.message || "");

    if (message.includes("invalid_credential")) {
      return NextResponse.json({ error: "invalid_credential" }, { status: 401 });
    }
    if (message.includes("gateway_request_replayed")) {
      return NextResponse.json({ error: "gateway_request_replayed" }, { status: 409 });
    }
    if (message.includes("gateway_event_rate_limit_exceeded")) {
      return NextResponse.json({ error: "gateway_event_rate_limit_exceeded" }, { status: 429 });
    }
    if (message.includes("incident_workspace_mismatch")) {
      return NextResponse.json({ error: "incident_workspace_mismatch" }, { status: 403 });
    }

    return NextResponse.json({ error: "gateway_event_persistence_failed" }, { status: 503 });
  }

  const row = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    recorded: true,
    eventId: row?.event_id ?? null,
    incidentId: row?.incident_id ?? null,
  });
}
