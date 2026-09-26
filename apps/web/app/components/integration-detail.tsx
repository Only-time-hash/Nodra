import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Code2,
  Database,
  KeyRound,
  Network,
  ShieldCheck,
} from "lucide-react";
import { WorkspaceSidebar } from "./workspace-sidebar";

type Guide = {
  title: string;
  eyebrow: string;
  description: string;
  bullets: string[];
  code: string;
  note: string;
};

const guides: Record<string, Guide> = {
  gateway: {
    title: "Protected Agent Gateway",
    eyebrow: "RUNTIME ENFORCEMENT",
    description: "The gateway is the enforcement boundary between a protected agent and consequential tools or resources.",
    bullets: [
      "Authenticate every protected agent request.",
      "Verify timestamp, nonce, body digest and HMAC signature.",
      "Evaluate the registered agent authority scope.",
      "Record tamper-evident authorization evidence.",
      "Return allow, deny or require-approval decisions before execution.",
    ],
    code: `POST /api/gateway/authorize
x-nodra-credential: <server-side secret>
x-nodra-timestamp: <unix seconds>
x-nodra-nonce: <unique nonce>
x-nodra-signature: v1=<hmac-sha256>`,
    note: "Keep the credential server-side. Never expose it in browser code.",
  },
  javascript: {
    title: "JavaScript / TypeScript",
    eyebrow: "SDK INTEGRATION",
    description: "Protect a Node.js or TypeScript agent with the Nodra SDK workspace.",
    bullets: [
      "Store NODRA_BASE_URL, NODRA_CREDENTIAL and NODRA_WORKSPACE_ID server-side.",
      "Initialize Nodra once in the agent runtime.",
      "Wrap the agent identity with nodra.protect().",
      "Authorize consequential actions before executing the external tool.",
      "Use the returned decision as the execution gate.",
    ],
    code: `import { Nodra } from "@nodra/sdk";

const nodra = new Nodra({
  baseUrl: process.env.NODRA_BASE_URL!,
  credential: process.env.NODRA_CREDENTIAL!,
  workspaceId: process.env.NODRA_WORKSPACE_ID!,
});

const agent = nodra.protect({ id: "finance-agent" });

const decision = await agent.authorize({
  resourceId: "stripe",
  action: "payments.submit",
});`,
    note: "The SDK currently lives in the Nodra repository workspace while public package distribution is prepared.",
  },
  python: {
    title: "Python",
    eyebrow: "PYTHON INTEGRATION",
    description: "Connect Python agents through the signed Nodra gateway without weakening the request-authentication model.",
    bullets: [
      "Build the exact JSON request body first.",
      "Hash the raw body with SHA-256.",
      "Create a fresh timestamp and nonce.",
      "Sign the canonical request with HMAC-SHA256 using the Nodra credential.",
      "Send the signed request to /api/gateway/authorize.",
    ],
    code: `canonical = f"v1\\n{timestamp}\\n{nonce}\\n{body_hash}"
signature = hmac.new(
    credential.encode(),
    canonical.encode(),
    hashlib.sha256,
).hexdigest()

requests.post(
    f"{base_url}/api/gateway/authorize",
    data=body,
    headers={
        "content-type": "application/json",
        "x-nodra-credential": credential,
        "x-nodra-timestamp": timestamp,
        "x-nodra-nonce": nonce,
        "x-nodra-signature": f"v1={signature}",
    },
)`,
    note: "Keep signing on the server/runtime side. Do not perform it in browser JavaScript.",
  },
  rest: {
    title: "REST API",
    eyebrow: "LANGUAGE-INDEPENDENT",
    description: "Use the Nodra authorization gateway from any backend capable of SHA-256 and HMAC-SHA256.",
    bullets: [
      "Register the agent and define authority first.",
      "Issue a server-side integration credential.",
      "Sign each request using the exact raw request body.",
      "Treat the Nodra response as the execution decision.",
      "Record downstream results through protected runtime evidence.",
    ],
    code: `POST /api/gateway/authorize
Content-Type: application/json
x-nodra-credential: <credential>
x-nodra-timestamp: <unix-seconds>
x-nodra-nonce: <unique-nonce>
x-nodra-signature: v1=<signature>

{
  "agentId": "finance-agent",
  "resourceId": "stripe",
  "action": "payments.submit"
}`,
    note: "A signed request is bound to its body, timestamp and nonce, which prevents simple replay of captured requests.",
  },
  mcp: {
    title: "MCP Guard",
    eyebrow: "TOOL CONTROL",
    description: "Place Nodra at the boundary before consequential MCP tool calls are allowed to execute.",
    bullets: [
      "Keep Nodra credentials in the MCP server or protected runtime.",
      "Map the calling agent to its registered Nodra identity.",
      "Authorize the tool action before invoking the MCP tool.",
      "Deny or require human approval when authority is insufficient.",
      "Preserve evidence linking the agent, action and tool boundary.",
    ],
    code: `{
  "env": {
    "NODRA_BASE_URL": "http://localhost:3000",
    "NODRA_AGENT_ID": "finance-agent",
    "NODRA_WORKSPACE_ID": "<workspace-id>",
    "NODRA_CREDENTIAL": "<server-side-secret>"
  }
}`,
    note: "Nodra should wrap consequential tool execution, not just inspect prompts.",
  },
  supabase: {
    title: "Supabase Evidence Store",
    eyebrow: "SECURITY EVIDENCE",
    description: "Nodra uses workspace-scoped persistence for agents, credentials, incidents and tamper-evident security events.",
    bullets: [
      "Agent and event records are workspace-scoped.",
      "Integration secrets are stored as one-way hashes.",
      "Security events retain sequence and hash-chain evidence.",
      "Credential use updates runtime evidence and last-used state.",
      "Authenticated console pages read only the active workspace context.",
    ],
    code: `security_events
  sequence_no
  prev_hash
  event_hash
  agent_id
  action
  decision
  occurred_at`,
    note: "The Supabase service-role secret is not required in browser code and must never be exposed client-side.",
  },
};

export function IntegrationDetail({ slug }: { slug: string }) {
  const guide = guides[slug] ?? guides.gateway;
  const Icon = slug === "supabase" ? Database : slug === "gateway" ? Network : slug === "javascript" || slug === "python" || slug === "rest" ? Code2 : ShieldCheck;

  return (
    <main className="lab">
      <WorkspaceSidebar active="Integrations" />
      <section className="labMain">
        <div className="commandTopbar">
          <div className="commandSearch integrationBreadcrumb">
            <span>NODRA / INTEGRATIONS / {guide.title.toUpperCase()}</span>
          </div>
          <div className="topbarStatus">
            <span className="liveIndicator live"><i /> LIVE</span>
            <span>V0.1</span>
          </div>
        </div>

        <div className="integrationDetail">
          <Link className="integrationBack" href="/integrations"><ArrowLeft /> Back to Integrations</Link>

          <header className="integrationDetailHero">
            <div className="integrationDetailIcon"><Icon /></div>
            <div>
              <span>{guide.eyebrow}</span>
              <h1>{guide.title}</h1>
              <p>{guide.description}</p>
            </div>
            <div className="integrationReady"><CheckCircle2 /> Ready</div>
          </header>

          <div className="integrationDetailGrid">
            <section className="refMainPanel integrationSteps">
              <div className="refPanelTitle">
                <div>
                  <h3>Implementation checklist</h3>
                  <small>Complete these steps in your real server-side runtime.</small>
                </div>
              </div>
              {guide.bullets.map((item, index) => (
                <article key={item}>
                  <span>{index + 1}</span>
                  <div><b>{item}</b></div>
                  <CheckCircle2 />
                </article>
              ))}
            </section>

            <aside className="refSidePanel integrationSecurity">
              <KeyRound />
              <h3>Security boundary</h3>
              <p>{guide.note}</p>
              <Link href="/credentials">Open Credentials</Link>
              <Link href="/activity">View Security Events</Link>
            </aside>
          </div>

          <section className="refMainPanel integrationCodePanel">
            <div className="refPanelTitle">
              <div>
                <h3>Reference implementation</h3>
                <small>Use this as the server-side starting point.</small>
              </div>
            </div>
            <pre><code>{guide.code}</code></pre>
          </section>

          <section className="integrationNext">
            <div>
              <ShieldCheck />
              <span><b>Already connected?</b><small>Verify signed runtime evidence from the protected agent.</small></span>
            </div>
            <Link href="/activity">Open Flight Recorder</Link>
          </section>
        </div>
      </section>
    </main>
  );
}
