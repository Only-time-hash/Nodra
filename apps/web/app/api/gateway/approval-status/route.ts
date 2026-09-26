import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { hashIntegrationSecret } from "../../../../lib/integration-credentials";
import { verifyCredentialRequest } from "../../../../lib/gateway-signing";

export async function POST(request: Request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 16_384) {
    return NextResponse.json({ error: "approval_status_request_too_large" }, { status: 413 });
  }

  let body: any;
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json({ error: "invalid_approval_status_request" }, { status: 400 });
  }

  if (
    typeof body?.agentId !== "string" ||
    typeof body?.resourceId !== "string" ||
    typeof body?.action !== "string" ||
    typeof body?.authorizationEventId !== "string"
  ) {
    return NextResponse.json({ error: "invalid_approval_status_request" }, { status: 400 });
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

  const supabase = createClient<any>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: apiAllowed, error: accessError } = await supabase.rpc(
    "integration_api_access_allowed",
    { p_secret_hash: hashIntegrationSecret(credential) },
  );

  if (accessError) return NextResponse.json({ error: "api_access_check_failed" }, { status: 503 });
  if (!apiAllowed) return NextResponse.json({ error: "workspace_api_access_disabled" }, { status: 403 });

  const { data, error } = await supabase.rpc("get_integration_approval_status", {
    p_secret_hash: hashIntegrationSecret(credential),
    p_external_agent_id: body.agentId,
    p_authorization_event_id: body.authorizationEventId,
    p_resource_external_id: body.resourceId,
    p_action: body.action,
  });

  if (error) {
    const message = String(error.message || "");
    if (message.includes("invalid_credential")) {
      return NextResponse.json({ error: "invalid_credential" }, { status: 401 });
    }
    if (message.includes("approval_authorization_mismatch")) {
      return NextResponse.json({ error: "approval_authorization_mismatch" }, { status: 403 });
    }
    return NextResponse.json({ error: "approval_status_unavailable" }, { status: 503 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    status: row?.status ?? "pending",
    reason: row?.reason ?? null,
    decidedAt: row?.decided_at ?? null,
  });
}
