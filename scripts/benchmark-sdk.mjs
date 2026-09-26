import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import { Nodra } from "../packages/sdk/dist/index.js";

const REQUESTS = Number(process.env.NODRA_BENCH_REQUESTS || 500);
const CONCURRENCY = Number(process.env.NODRA_BENCH_CONCURRENCY || 25);
const MAX_P95_MS = Number(process.env.NODRA_BENCH_MAX_P95_MS || 250);
const credential = "ndra_benchmark_123456789012345678901234567890123456";

const server = createServer(async (req, res) => {
  for await (const _chunk of req) {}
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({
    decision: "allow",
    reason: "authority_scope_allows",
    agentId: "benchmark-agent",
    resourceId: "benchmark-tool",
    action: "tool.call",
    authorizationEventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  }));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("benchmark_server_unavailable");

const nodra = new Nodra({
  baseUrl: `http://127.0.0.1:${address.port}`,
  credential,
  maxRetries: 0,
  timeoutMs: 5_000,
});

const samples = [];
let cursor = 0;

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= REQUESTS) return;

    const started = performance.now();
    const decision = await nodra.authorize({
      agentId: "benchmark-agent",
      resourceId: "benchmark-tool",
      action: "tool.call",
      context: { environment: "benchmark", metadata: { request: index } },
    });
    if (decision.decision !== "allow") throw new Error("benchmark_authorization_failed");
    samples.push(performance.now() - started);
  }
}

const suiteStarted = performance.now();
try {
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  );
}

samples.sort((a, b) => a - b);
const percentile = (p) => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))];
const totalMs = performance.now() - suiteStarted;
const rps = REQUESTS / (totalMs / 1000);
const report = {
  requests: REQUESTS,
  concurrency: CONCURRENCY,
  p50Ms: Number(percentile(0.50).toFixed(2)),
  p95Ms: Number(percentile(0.95).toFixed(2)),
  p99Ms: Number(percentile(0.99).toFixed(2)),
  throughputRps: Number(rps.toFixed(1)),
};

console.log(JSON.stringify(report, null, 2));

if (report.p95Ms > MAX_P95_MS) {
  throw new Error(`SDK/local-gateway p95 ${report.p95Ms}ms exceeded ${MAX_P95_MS}ms gate`);
}
