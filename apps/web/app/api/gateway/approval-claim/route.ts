import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { hashIntegrationSecret } from "../../../../lib/integration-credentials";
import { verifyCredentialRequest } from "../../../../lib/gateway-signing";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function POST(request: Request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 16_384) {
    return NextResponse.json({ error: "approval_claim_request_too_large" }, { status: 413 });
  }

  let body: any;
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json({ error: "invalid_approval_claim_request" }, { status: 400 });
  }

  if (
    typeof body?.agentId !== "string" ||
    typeof body?.resourceId !== "string" ||
    typeof body?.action !== "string" ||
    typeof body?.authorizationEventId !== "string" ||
    typeof body?.executionToken !== "string" ||
    body.executionToken.length < 24 ||
    body.executionToken.length > 256
  ) {
    return NextResponse.json({ error: "invalid_approval_claim_request" }, { status: 400 });
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

  const secretHash = hashIntegrationSecret(credential);
  const { data: apiAllowed, error: accessError } = await supabase.rpc(
    "integration_api_access_allowed",
    { p_secret_hash: secretHash },
  );

  if (accessError) return NextResponse.json({ error: "api_access_check_failed" }, { status: 503 });
  if (!apiAllowed) return NextResponse.json({ error: "workspace_api_access_disabled" }, { status: 403 });

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase.rpc("claim_integration_approval_token", {
    p_secret_hash: secretHash,
    p_external_agent_id: body.agentId,
    p_authorization_event_id: body.authorizationEventId,
    p_resource_external_id: body.resourceId,
    p_action: body.action,
    p_execution_token_hash: hash(body.executionToken),
    p_execution_token_expires_at: expiresAt,
  });

  if (error) {
    const message = String(error.message || "");
    if (message.includes("invalid_credential")) {
      return NextResponse.json({ error: "invalid_credential" }, { status: 401 });
    }
    if (message.includes("approval_pending")) {
      return NextResponse.json({ error: "approval_pending" }, { status: 409 });
    }
    if (message.includes("approval_denied")) {
      return NextResponse.json({ error: "approval_denied" }, { status: 403 });
    }
    if (message.includes("approval_authorization_mismatch")) {
      return NextResponse.json({ error: "approval_authorization_mismatch" }, { status: 403 });
    }
    if (message.includes("approval_token_already_claimed")) {
      return NextResponse.json({ error: "approval_token_already_claimed" }, { status: 409 });
    }
    if (message.includes("approval_token_expired")) {
      return NextResponse.json({ error: "approval_token_expired" }, { status: 403 });
    }
    if (message.includes("approval_token_consumed")) {
      return NextResponse.json({ error: "approval_token_consumed" }, { status: 409 });
    }
    return NextResponse.json({ error: "approval_claim_unavailable" }, { status: 503 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    status: row?.status ?? "approved",
    expiresAt: row?.expires_at ?? expiresAt,
  });
}
