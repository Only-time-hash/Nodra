import { createHash, createHmac, randomUUID } from "node:crypto";

const baseUrl = process.env.NODRA_BASE_URL || "http://localhost:3000";
const credential = process.env.NODRA_CREDENTIAL;
const agentId = process.env.NODRA_AGENT_ID || "finance-agent";

if (!credential || credential.length < 32) {
  console.error("Missing NODRA_CREDENTIAL or credential is too short.");
  process.exit(1);
}

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

const response = await fetch(new URL("/api/gateway/authorize", baseUrl), {
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

const data = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error("Nodra test-agent request failed:", response.status, data);
  process.exit(1);
}

console.log("Nodra test-agent request succeeded.");
console.log("Agent:", data.agentId);
console.log("Action:", data.action);
console.log("Decision:", data.decision);
console.log("Reason:", data.reason);
console.log("Authorization event:", data.authorizationEventId);
