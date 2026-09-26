import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { hashIntegrationSecret } from "../../../../lib/integration-credentials";
import { GATEWAY_SIGNATURE_MAX_AGE_SECONDS, verifyCredentialRequest } from "../../../../lib/gateway-signing";
import { checkRateLimit } from "../../../../lib/rate-limit";

export async function POST(request: Request) {
  const raw = await request.text();

  if (Buffer.byteLength(raw, "utf8") > 32768) {
    return NextResponse.json({ error: "authorization_request_too_large" }, { status: 413 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_authorization_request" }, { status: 400 });
  }

  if (
    !body ||
    typeof body.agentId !== "string" ||
    typeof body.resourceId !== "string" ||
    typeof body.action !== "string" ||
    body.agentId.length > 128 ||
    body.resourceId.length > 128 ||
    body.action.length > 128
  ) {
    return NextResponse.json({ error: "invalid_authorization_request" }, { status: 400 });
  }

  const credential = request.headers.get("x-nodra-credential");
  if (!credential) {
    return NextResponse.json({ error: "credential_missing" }, { status: 401 });
  }

  const verified = verifyCredentialRequest(
    raw,
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
    "gateway-authorize:" + hashIntegrationSecret(credential).slice(0, 20),
    240,
    60_000,
  );

  if (!local.allowed) {
    return NextResponse.json(
      { error: "authorization_rate_limit_exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(local.retryAfterSeconds) },
      },
    );
  }

  const accessCheckClient = createClient<any>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: apiAllowed, error: apiAccessError } = await accessCheckClient.rpc("integration_api_access_allowed", {
    p_secret_hash: hashIntegrationSecret(credential),
  });
  if (apiAccessError) {
    return NextResponse.json({ error: "api_access_check_failed" }, { status: 503 });
  }
  if (!apiAllowed) {
    return NextResponse.json({ error: "workspace_api_access_disabled" }, { status: 403 });
  }

  const supabase = createClient<any>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.rpc("authorize_integration_gateway", {
    p_secret_hash: hashIntegrationSecret(credential),
    p_external_agent_id: body.agentId,
    p_nonce: verified.nonce,
    p_request_timestamp: new Date(verified.timestamp * 1000).toISOString(),
    p_expires_at: new Date(
      (verified.timestamp + GATEWAY_SIGNATURE_MAX_AGE_SECONDS) * 1000,
    ).toISOString(),
    p_resource_id: body.resourceId,
    p_action: body.action,
  });

  if (error) {
    const message = String(error.message || "");

    if (message.includes("invalid_credential")) {
      return NextResponse.json({ error: "invalid_credential" }, { status: 401 });
    }

    if (message.includes("gateway_request_replayed")) {
      return NextResponse.json({ error: "gateway_request_replayed" }, { status: 409 });
    }

    if (message.includes("authorization_rate_limit_exceeded")) {
      return NextResponse.json(
        { error: "authorization_rate_limit_exceeded" },
        { status: 429 },
      );
    }

    return NextResponse.json({ error: "authorization_evidence_unavailable" }, { status: 503 });
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row?.authorization_event_id) {
    return NextResponse.json({ error: "authorization_evidence_unavailable" }, { status: 503 });
  }

  let decision =
    row.decision === "require_approval" ? "require-approval" : row.decision;
  let reason = row.reason;
  let authorizationEventId = row.authorization_event_id;

  if (decision === "allow") {
    const secretHash = hashIntegrationSecret(credential);
    const { data: highImpactReview, error: highImpactError } = await supabase.rpc(
      "integration_high_impact_review_enabled",
      {
        p_secret_hash: secretHash,
        p_action: body.action,
      },
    );

    if (highImpactError) {
      return NextResponse.json({ error: "approval_policy_check_failed" }, { status: 503 });
    }

    if (highImpactReview) {
      const { data: overrideEventId, error: overrideError } = await supabase.rpc(
        "append_high_impact_review_override",
        {
          p_secret_hash: secretHash,
          p_original_event_id: row.authorization_event_id,
          p_action: body.action,
          p_resource_external_id: body.resourceId,
        },
      );

      if (overrideError || !overrideEventId) {
        return NextResponse.json({ error: "approval_override_evidence_failed" }, { status: 503 });
      }

      decision = "require-approval";
      reason = "workspace_high_impact_review";
      authorizationEventId = overrideEventId;
    }
  }

  return NextResponse.json({
    decision,
    reason,
    agentId: row.agent_external_id,
    resourceId: body.resourceId,
    action: body.action,
    authorizationEventId,
  });
}
