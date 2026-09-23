import { createHash, createHmac, randomUUID } from "node:crypto";

const configuredBaseUrl = process.env.NODRA_BASE_URL?.trim();
const credential = process.env.NODRA_CREDENTIAL;
const agentId = process.env.NODRA_AGENT_ID || "finance-agent";

if (!credential || credential.length < 32) {
  console.error("Missing NODRA_CREDENTIAL or credential is too short.");
  process.exit(1);
}

const candidates = configuredBaseUrl
  ? [configuredBaseUrl]
  : ["http://127.0.0.1:3000", "http://127.0.0.1:3001"];

const payload = {
  agentId,
  resourceId: "stripe",
  action: "payments.submit",
};

const body = JSON.stringify(payload);
const timestamp = String(Math.floor(Date.now() / 1000));
const nonce = randomUUID().replaceAll("-", "");
const bodyDigest = createHash("sha256").update(body).digest("hex");
const canonical = ["v1", timestamp, nonce, bodyDigest].join("\n");
const signature = createHmac("sha256", credential).update(canonical).digest("hex");

let response = null;
let baseUrl = "";
let lastError = null;

for (const candidate of candidates) {
  try {
    const result = await fetch(new URL("/api/gateway/authorize", candidate), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nodra-credential": credential,
        "x-nodra-timestamp": timestamp,
        "x-nodra-nonce": nonce,
        "x-nodra-signature": "v1=" + signature,
      },
      body,
    });

    response = result;
    baseUrl = candidate;
    break;
  } catch (error) {
    lastError = error;
  }
}

if (!response) {
  console.error("Could not reach the local Nodra server.");
  console.error("Start Nodra in another terminal with: npm run dev");
  console.error("Then confirm whether Next.js is running on port 3000 or 3001.");
  if (configuredBaseUrl) {
    console.error("Configured NODRA_BASE_URL:", configuredBaseUrl);
  } else {
    console.error("Tried:", candidates.join(", "));
  }
  if (lastError?.cause?.code) {
    console.error("Network error:", lastError.cause.code);
  }
  process.exit(1);
}

const data = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error("Nodra test-agent request failed:", response.status, data);
  console.error("Server:", baseUrl);
  process.exit(1);
}

console.log("Nodra test-agent request succeeded.");
console.log("Server:", baseUrl);
console.log("Agent:", data.agentId);
console.log("Action:", data.action);
console.log("Decision:", data.decision);
console.log("Reason:", data.reason);
console.log("Authorization event:", data.authorizationEventId);
