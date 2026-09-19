import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const GATEWAY_SIGNATURE_VERSION = "v1";
export const GATEWAY_SIGNATURE_MAX_AGE_SECONDS = 300;

export type GatewaySignatureHeaders = {
  "x-nodra-timestamp": string;
  "x-nodra-nonce": string;
  "x-nodra-signature": string;
};

type SigningIdentity = {
  workspaceId: string;
  agentId: string;
  masterSecret: string;
};

function requireMasterSecret(secret: string) {
  if (secret.length < 32) {
    throw new Error("NODRA_GATEWAY_SIGNING_SECRET must contain at least 32 characters.");
  }
}

function deriveAgentKey(identity: SigningIdentity) {
  requireMasterSecret(identity.masterSecret);
  return createHmac("sha256", identity.masterSecret)
    .update(`nodra-agent-key-v1\n${identity.workspaceId}\n${identity.agentId}`)
    .digest();
}

function canonicalRequest(body: string, timestamp: string, nonce: string) {
  const bodyDigest = createHash("sha256").update(body).digest("hex");
  return `${GATEWAY_SIGNATURE_VERSION}\n${timestamp}\n${nonce}\n${bodyDigest}`;
}

export function signGatewayRequest(
  body: string,
  identity: SigningIdentity,
  options: { timestamp?: number; nonce?: string } = {},
): GatewaySignatureHeaders {
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
  const nonce = options.nonce ?? randomUUID();
  const digest = createHmac("sha256", deriveAgentKey(identity))
    .update(canonicalRequest(body, timestamp, nonce))
    .digest("hex");

  return {
    "x-nodra-timestamp": timestamp,
    "x-nodra-nonce": nonce,
    "x-nodra-signature": `${GATEWAY_SIGNATURE_VERSION}=${digest}`,
  };
}

export function verifyGatewayRequest(
  body: string,
  headers: { timestamp: string | null; nonce: string | null; signature: string | null },
  identity: SigningIdentity,
  nowSeconds = Math.floor(Date.now() / 1000),
): { valid: true; timestamp: number; nonce: string } | { valid: false; reason: string } {
  const { timestamp, nonce, signature } = headers;
  if (!timestamp || !nonce || !signature) return { valid: false, reason: "signature_headers_missing" };
  if (!/^\d{10}$/.test(timestamp)) return { valid: false, reason: "signature_timestamp_invalid" };
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(nonce)) return { valid: false, reason: "signature_nonce_invalid" };

  const timestampNumber = Number(timestamp);
  if (Math.abs(nowSeconds - timestampNumber) > GATEWAY_SIGNATURE_MAX_AGE_SECONDS) {
    return { valid: false, reason: "signature_expired" };
  }

  const match = /^v1=([a-f0-9]{64})$/.exec(signature);
  if (!match) return { valid: false, reason: "signature_format_invalid" };

  const expected = createHmac("sha256", deriveAgentKey(identity))
    .update(canonicalRequest(body, timestamp, nonce))
    .digest();
  const supplied = Buffer.from(match[1], "hex");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return { valid: false, reason: "signature_invalid" };
  }

  return { valid: true, timestamp: timestampNumber, nonce };
}
