"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Code2,
  Eye,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  Network,
  Play,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { NodraMark } from "../../../components/nodra-mark";
import "../flow.css";

type Agent = {
  external_id: string;
  name: string;
  status: string;
  authority_scope: string[];
};

type IntegrationMethod = "javascript" | "python" | "rest" | "mcp";

const progress = [
  "Register",
  "Authority",
  "Credential",
  "Choose",
  "Integrate",
  "Test",
  "Protected",
  "Complete",
];

const methods: Array<{ id: IntegrationMethod; label: string }> = [
  { id: "javascript", label: "JavaScript / TypeScript" },
  { id: "python", label: "Python" },
  { id: "rest", label: "REST API" },
  { id: "mcp", label: "MCP" },
];

const scopes = [
  ["invoices.read", "Read invoices"],
  ["payments.create", "Create payments"],
  ["payments.submit", "Submit payments"],
  ["bank.accounts", "Access bank accounts"],
  ["data.export", "Export financial data"],
] as const;

function snippetFor(method: IntegrationMethod, agentId: string, workspaceId: string) {
  if (method === "python") {
    return [
      "import hashlib",
      "import hmac",
      "import json",
      "import os",
      "import time",
      "import uuid",
      "import requests",
      "",
      'base_url = os.environ["NODRA_BASE_URL"]',
      'credential = os.environ["NODRA_CREDENTIAL"]',
      'agent_id = "' + agentId + '"',
      "",
      'payload = {"agentId": agent_id, "resourceId": "stripe", "action": "payments.submit"}',
      'body = json.dumps(payload, separators=(",", ":"))',
      'timestamp = str(int(time.time()))',
      'nonce = uuid.uuid4().hex',
      'body_hash = hashlib.sha256(body.encode()).hexdigest()',
      'canonical = f"v1\\n{timestamp}\\n{nonce}\\n{body_hash}"',
      'signature = hmac.new(credential.encode(), canonical.encode(), hashlib.sha256).hexdigest()',
      "",
      "response = requests.post(",
      '    f"{base_url}/api/v1/authorize",',
      "    data=body,",
      "    headers={",
      '        "content-type": "application/json",',
      '        "x-nodra-credential": credential,',
      '        "x-nodra-timestamp": timestamp,',
      '        "x-nodra-nonce": nonce,',
      '        "x-nodra-signature": f"v1={signature}",',
      "    },",
      ")",
      "response.raise_for_status()",
      "decision = response.json()",
    ].join("\n");
  }

  if (method === "rest") {
    return [
      "# REST requests must be signed server-side.",
      "# Build the exact JSON body first:",
      "",
      '{"agentId":"' + agentId + '","resourceId":"stripe","action":"payments.submit"}',
      "",
      "# Then compute:",
      "# bodyDigest = SHA256(rawBody)",
      '# timestamp = current Unix time in seconds',
      '# nonce = unique 20-128 character value',
      '# canonical = "v1\\\\n" + timestamp + "\\\\n" + nonce + "\\\\n" + bodyDigest',
      '# signature = HMAC-SHA256(NODRA_CREDENTIAL, canonical)',
      "",
      "POST /api/v1/authorize HTTP/1.1",
      "Host: localhost:3000",
      "Content-Type: application/json",
      "x-nodra-credential: $NODRA_CREDENTIAL",
      "x-nodra-timestamp: <timestamp>",
      "x-nodra-nonce: <nonce>",
      "x-nodra-signature: v1=<hex-signature>",
      "",
      '{"agentId":"' + agentId + '","resourceId":"stripe","action":"payments.submit"}',
    ].join("\n");
  }

  if (method === "mcp") {
    return [
      "# Keep Nodra credentials in the MCP server/runtime environment.",
      "{",
      '  "mcpServers": {',
      '    "nodra-protected-tools": {',
      '      "command": "your-agent-runtime",',
      '      "env": {',
      '        "NODRA_BASE_URL": "http://localhost:3000",',
      '        "NODRA_AGENT_ID": "' + agentId + '",',
      '        "NODRA_WORKSPACE_ID": "' + (workspaceId || "<workspace-id>") + '",',
      '        "NODRA_CREDENTIAL": "<saved-secret>"',
      "      }",
      "    }",
      "  }",
      "}",
      "",
      "# In your server runtime, initialize nodra-agent-sdk and use mcpGuard(...)",
      "# before executing MCP tools so every tool call is authorized and recorded.",
    ].join("\n");
  }

  return [
    'import { Nodra } from "nodra-agent-sdk";',
    "",
    "const nodra = new Nodra({",
    "  baseUrl: process.env.NODRA_BASE_URL!,",
    "  credential: process.env.NODRA_CREDENTIAL!,",
    "  workspaceId: process.env.NODRA_WORKSPACE_ID!,",
    "});",
    "",
    "const agent = nodra.protect({",
    '  id: "' + agentId + '",',
    "});",
    "",
    'const decision = await agent.authorize({',
    '  resourceId: "stripe",',
    '  action: "payments.submit",',
    '  context: { environment: "production" },',
    "});",
  ].join("\n");
}

function ProtectPageContent() {
  const searchParams = useSearchParams();
  const validEntry = searchParams.get("entry") === "overview";
  const [agents, setAgents] = useState<Agent[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [step, setStep] = useState(0);
  const [externalId, setExternalId] = useState("finance-agent");
  const [name, setName] = useState("Finance Agent");
  const [description, setDescription] = useState(
    "Autonomous agent for invoice processing, payments, and financial reporting.",
  );
  const [category, setCategory] = useState("Finance");
  const [environment, setEnvironment] = useState("Production");
  const [scope, setScope] = useState<string[]>([
    "invoices.read",
    "payments.create",
    "payments.submit",
  ]);
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [method, setMethod] = useState<IntegrationMethod>("javascript");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [check, setCheck] = useState<any>(null);
  const [decision, setDecision] = useState<any>(null);
  const [altIcon, setAltIcon] = useState(false);
  const [integrationChecklist, setIntegrationChecklist] = useState([false, false, false, false, false]);

  const agent = useMemo(
    () => agents.find((item) => item.external_id === externalId) || agents[0],
    [agents, externalId],
  );

  const activeAgentId = agent?.external_id || externalId;
  const snippet = useMemo(
    () => snippetFor(method, activeAgentId, workspaceId),
    [method, activeAgentId, workspaceId],
  );

  async function loadAgents() {
    const response = await fetch("/api/integrations/agents");

    if (response.status === 401) {
      location.href = "/auth?intent=signin";
      return;
    }

    if (response.ok) {
      const json = await response.json();
      setAgents(json.agents ?? []);
      setWorkspaceId(String(json.workspaceId ?? ""));
    }
  }

  useEffect(() => {
    if (!validEntry) {
      window.location.replace("/onboarding/welcome");
      return;
    }
    void loadAgents();
  }, [validEntry]);

  function toggleScope(value: string) {
    setScope((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  async function registerAgent() {
    setBusy(true);
    setMessage("");

    const response = await fetch("/api/integrations/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        externalId,
        name,
        authorityScope: scope,
      }),
    });

    const json = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      if (response.status === 409 && json.error === "agent_id_already_exists") {
        const existingResponse = await fetch("/api/integrations/agents");

        if (existingResponse.ok) {
          const existingJson = await existingResponse.json();
          const existingAgents = existingJson.agents ?? [];
          const existing = existingAgents.find(
            (item: Agent) => item.external_id === externalId,
          );

          if (existing) {
            setAgents(existingAgents);
            setName(existing.name || name);
            setScope(
              Array.isArray(existing.authority_scope) && existing.authority_scope.length
                ? existing.authority_scope
                : scope,
            );
            setMessage("");
            setStep(1);
            return;
          }
        }

        setMessage(
          "This Agent ID already exists. Choose a different Agent ID or reload the existing agent.",
        );
        return;
      }

      setMessage(json.error ?? "Could not register agent.");
      return;
    }

    await loadAgents();
    setStep(1);
  }

  async function saveAuthority() {
    const id = agent?.external_id || externalId;
    setBusy(true);
    setMessage("");

    const response = await fetch("/api/integrations/agents", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        externalId: id,
        authorityScope: scope,
      }),
    });

    setBusy(false);

    if (!response.ok) {
      setMessage("Could not save authority.");
      return;
    }

    await loadAgents();
    setStep(2);
  }

  async function generateCredential() {
    const id = agent?.external_id || externalId;
    setBusy(true);
    setMessage("");

    const response = await fetch("/api/integrations/credentials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId: id,
        label: "Primary integration",
      }),
    });

    const json = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setMessage(json.error ?? "Could not generate credential.");
      return;
    }

    setSecret(json.secret ?? "");
    setShowSecret(true);
  }

  async function testConnection(advance = true) {
    const id = agent?.external_id || externalId;
    setBusy(true);
    setMessage("");

    const response = await fetch("/api/integrations/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: id }),
    });

    const json = await response.json().catch(() => ({}));
    setBusy(false);
    setCheck(json);

    if (!json.connected) {
      setMessage(
        json.message ||
          "Nodra is waiting for your real integrated agent to use the credential and emit recent protected runtime evidence.",
      );
      return;
    }

    if (advance) setStep(6);
  }

  async function verifyProtectedAction() {
    const id = agent?.external_id || externalId;
    setBusy(true);
    setMessage("");

    const response = await fetch("/api/integrations/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: id }),
    });

    const json = await response.json().catch(() => ({}));
    setBusy(false);

    const verified = Boolean(json.connected);

    setDecision({
      verified,
      decisionId: json.decisionId || "Recent signed evidence",
      time: new Date().toLocaleString(),
      message:
        json.message ||
        (verified
          ? "Nodra verified recent protected runtime evidence."
          : "No recent protected runtime evidence found."),
    });

    if (verified) {
      setStep(7);
    } else {
      setMessage(
        "Run your real integrated agent through Nodra once, then verify again.",
      );
    }
  }

  if (!validEntry) {
    return <main className="flowPage" />;
  }

  return (
    <main className="flowPage">
      <header className="flowHeader">
        <Link href="/" className="flowBrand" aria-label="Nodra home">
          <span className="flowBrandMark"><NodraMark /></span>
          <b>NODRA</b>
        </Link>
        <Link href="/docs" className="flowHelp">ⓘ Help</Link>
      </header>

      <section className="flowShell">
        <div className="protectProgress" aria-label="Agent protection progress">
          {progress.map((label, index) => (
            <div
              className={[
                "protectProgressItem",
                index === step ? "active" : "",
                index < step ? "done" : "",
              ].filter(Boolean).join(" ")}
              key={label}
            >
              <span>{index + 1}</span>
              <strong>{label}</strong>
            </div>
          ))}
        </div>

        {step === 0 && (
          <section className="protectCard registerCard">
            <div className="protectForm">
              <span className="flowKicker">REGISTER</span>
              <h1>Register Your Agent</h1>
              <p>Tell us about your agent.</p>

              <div className="protectField">
                <label>Agent Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="protectField">
                <label>Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div className="protectFieldRow">
                <div className="protectField">
                  <label>Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option>Finance</option>
                    <option>Operations</option>
                    <option>Support</option>
                    <option>Research</option>
                  </select>
                </div>

                <div className="protectField">
                  <label>Environment</label>
                  <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                    <option>Production</option>
                    <option>Staging</option>
                    <option>Development</option>
                  </select>
                </div>
              </div>

              <div className="protectField">
                <label>Agent ID</label>
                <input value={externalId} onChange={(e) => setExternalId(e.target.value)} />
              </div>

              <div className="protectFooter">
                <button className="btn btnGhost" type="button" onClick={() => location.href="/onboarding/overview"}>
                  Cancel
                </button>
                <button className="btn btnPrimary" type="button" onClick={registerAgent} disabled={busy}>
                  {busy ? "Saving…" : "Next"} {!busy && <ChevronRight size={16} />}
                </button>
              </div>
            </div>

            <aside className="protectAgentVisual">
              <div className="protectAgentOrb">
                {altIcon ? <ShieldCheck /> : <Bot />}
              </div>
              <small>Protected<br />agent<br />identity</small>
              <button className="btn btnSecondary" type="button" onClick={() => setAltIcon((v) => !v)}>
                Change Icon
              </button>
            </aside>
          </section>
        )}

        {step === 1 && (
          <section className="protectCard">
            <span className="flowKicker">AUTHORITY</span>
            <h1>Define Authority</h1>
            <p>Set what this agent is allowed to do.</p>

            <div className="scopeList">
              {scopes.map(([value, label]) => (
                <label className="scopeItem" key={value}>
                  <input
                    type="checkbox"
                    checked={scope.includes(value)}
                    onChange={() => toggleScope(value)}
                  />
                  <div>
                    <strong>{label}</strong>
                    <div><code>{value}</code></div>
                  </div>
                  <span />
                </label>
              ))}
            </div>

            <div className="infoBox">
              <ShieldCheck />
              <div>
                <b>{scope.length} permissions selected</b>
                Nodra will deny actions outside this authority scope.
              </div>
            </div>

            <div className="protectFooter">
              <button className="btn btnSecondary" onClick={() => setStep(0)}>
                <ChevronLeft size={16} /> Back
              </button>
              <button className="btn btnPrimary" onClick={saveAuthority} disabled={busy || scope.length === 0}>
                {busy ? "Saving…" : "Next"} {!busy && <ChevronRight size={16} />}
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="protectCard">
            <span className="flowKicker">CREDENTIAL</span>
            <h1>Generate Integration Credential</h1>
            <p>This credential allows your server-side agent to securely connect to Nodra.</p>

            <div className="inlineField">
              <label>Agent ID</label>
              <div className="inlineValue">
                <code>{activeAgentId}</code>
                <button onClick={() => navigator.clipboard.writeText(activeAgentId)} aria-label="Copy agent ID">
                  <Clipboard size={14} />
                </button>
              </div>
            </div>

            <div className="inlineField">
              <label>Client Secret</label>
              <div className="inlineValue">
                <code>{secret ? (showSecret ? secret : "•".repeat(28)) : "Not generated yet"}</code>
                <div style={{display:"flex",gap:6}}>
                  <button
                    type="button"
                    onClick={() => setShowSecret((value) => !value)}
                    aria-label={showSecret ? "Hide client secret" : "Show client secret"}
                    title={showSecret ? "Hide secret" : "Show secret"}
                    disabled={!secret}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => secret && navigator.clipboard.writeText(secret)}
                    aria-label="Copy client secret"
                    title="Copy secret"
                    disabled={!secret}
                  >
                    <Clipboard size={14} />
                  </button>
                </div>
              </div>
            </div>

            {!secret ? (
              <button className="btn btnPrimary" onClick={generateCredential} disabled={busy}>
                <KeyRound size={16} /> {busy ? "Generating…" : "Generate Credential"}
              </button>
            ) : (
              <div className="warningBox">
                <TriangleAlert />
                <div><b>This secret will only be shown once.</b><br />Store it securely before continuing.</div>
              </div>
            )}

            <div className="protectFooter">
              <button className="btn btnSecondary" onClick={() => setStep(1)}>
                <ChevronLeft size={16} /> Back
              </button>
              <button className="btn btnPrimary" onClick={() => setStep(3)} disabled={!secret}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="protectCard">
            <span className="flowKicker">CHOOSE</span>
            <h1>Choose Your Integration Method</h1>
            <p>Select how you want to connect your agent.</p>

            <div className="methodTabs">
              {methods.map((item) => (
                <button
                  key={item.id}
                  className={method === item.id ? "active" : ""}
                  onClick={() => setMethod(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="infoBox" style={{ marginBottom: 14 }}>
              <Code2 />
              <div>
                <b>Server environment</b>
                <code style={{display:"block",marginTop:6}}>
                  NODRA_BASE_URL=http://localhost:3000<br />
                  NODRA_CREDENTIAL=&lt;the secret you saved&gt;<br />
                  NODRA_WORKSPACE_ID={workspaceId || "<workspace-id>"}
                </code>
              </div>
            </div>

            <div className="codeShell">
              <div className="codeHead">
                <span>{methods.find((item) => item.id === method)?.label}</span>
                <button onClick={() => navigator.clipboard.writeText(snippet)}>
                  <Clipboard size={13} /> Copy
                </button>
              </div>
              <pre>{snippet}</pre>
            </div>

            <div className="protectFooter">
              <button className="btn btnSecondary" onClick={() => setStep(2)}>
                <ChevronLeft size={16} /> Back
              </button>
              <button className="btn btnPrimary" onClick={() => setStep(4)}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="protectCard">
            <span className="flowKicker">INTEGRATE</span>
            <h1>Integrate Nodra</h1>
            <p>Add the code to your real server-side agent and run it.</p>

            <div className="checkList">
              {[
                "Install the SDK or use the REST/MCP integration",
                "Store the credential server-side",
                "Initialize Nodra with the agent ID",
                "Route consequential actions through Nodra",
                "Run the real agent once",
              ].map((label, index) => (
                <label key={label}>
                  <input
                    type="checkbox"
                    checked={integrationChecklist[index]}
                    onChange={() =>
                      setIntegrationChecklist((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index ? !value : value,
                        ),
                      )
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="infoBox" style={{ marginTop: 14 }}>
              <Network />
              <div>
                <b>Local verification command</b>
                After configuring the environment, run <code>npm run test:agent</code> in a second terminal.
              </div>
            </div>

            <div className="protectFooter">
              <button className="btn btnSecondary" onClick={() => setStep(3)}>
                <ChevronLeft size={16} /> Back
              </button>
              <button className="btn btnPrimary" onClick={() => setStep(5)} disabled={!integrationChecklist.every(Boolean)}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          </section>
        )}

        {step === 5 && (
          <section className="protectCard">
            <span className="flowKicker">TEST</span>
            <h1>Test Connection</h1>
            <p>Let&apos;s verify your real agent is connected to Nodra.</p>

            <button className="btn btnPrimary" onClick={() => testConnection(true)} disabled={busy}>
              <Network size={16} /> {busy ? "Testing…" : "Test Connection"}
            </button>

            {check && (
              <div className={"statusPanel" + (check.connected ? " success" : "")}>
                <div className="statusTop">
                  <span>{check.connected ? <Check size={16} /> : <Network size={16} />}</span>
                  <div>
                    <b>{check.connected ? "Connection successful" : "Waiting for protected runtime"}</b>
                    <p>{check.message}</p>
                  </div>
                </div>

                <div className="metaGrid">
                  <article><b>Agent ID</b><small>{activeAgentId}</small></article>
                  <article><b>Status</b><small>{check.connected ? "Connected" : "Waiting"}</small></article>
                  <article><b>Evidence</b><small>{check?.checks?.runtimeEvidence ? "Verified" : "Waiting"}</small></article>
                  <article><b>Environment</b><small>{environment}</small></article>
                </div>
              </div>
            )}

            <div className="protectFooter">
              <button className="btn btnSecondary" onClick={() => setStep(4)}>
                <ChevronLeft size={16} /> Back
              </button>
              <button className="btn btnPrimary" onClick={() => setStep(6)} disabled={!check?.connected}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          </section>
        )}

        {step === 6 && (
          <section className="protectCard">
            <span className="flowKicker">PROTECTED</span>
            <h1>Send First Protected Action</h1>
            <p>Run one real protected action in your integrated agent, then verify that Nodra received recent signed evidence.</p>

            <div className="infoBox">
              <FileCheck2 />
              <div>
                <b>Real runtime verification</b>
                This step does not fake an agent action from the browser. Nodra waits for signed evidence from your actual integration.
              </div>
            </div>

            <button className="btn btnPrimary" style={{ marginTop: 16 }} onClick={verifyProtectedAction} disabled={busy}>
              <Play size={16} /> {busy ? "Verifying…" : "Verify Protected Action"}
            </button>

            {decision && (
              <div className={"statusPanel" + (decision.verified ? " success" : "")}>
                <div className="statusTop">
                  <span>{decision.verified ? <Check size={16} /> : <Search size={16} />}</span>
                  <div>
                    <b>{decision.verified ? "Protected action verified" : "No recent protected action yet"}</b>
                    <p>{decision.message}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="protectFooter">
              <button className="btn btnSecondary" onClick={() => setStep(5)}>
                <ChevronLeft size={16} /> Back
              </button>
              <button className="btn btnPrimary" onClick={() => setStep(7)} disabled={!decision?.verified}>
                Complete Setup <ChevronRight size={16} />
              </button>
            </div>
          </section>
        )}

        {step === 7 && (
          <section className="protectCard success">
            <div className="successOrb"><Check /></div>
            <span className="flowKicker">AGENT PROTECTED</span>
            <h1>Your agent is protected!</h1>
            <p>Nodra verified the agent credential, authority configuration, and recent protected runtime evidence.</p>

            <div className="successMeta">
              <span><ShieldCheck size={15} /> Authority configured</span>
              <span><KeyRound size={15} /> Credential active</span>
              <span><FileCheck2 size={15} /> Runtime evidence verified</span>
              <span><LockKeyhole size={15} /> Protected workload ready</span>
            </div>

            <div className="flowActions">
              <Link className="flowPrimary" href="/network">
                Go to Dashboard <ChevronRight size={16} />
              </Link>
              <button
                className="btn btnSecondary"
                onClick={() => {
                  setStep(0);
                  setExternalId("new-agent");
                  setName("New Agent");
                  setDescription("");
                  setSecret("");
                  setShowSecret(false);
                  setCheck(null);
                  setDecision(null);
                  setMessage("");
                  setIntegrationChecklist([false, false, false, false, false]);
                }}
              >
                Add Another Agent
              </button>
            </div>
          </section>
        )}

        {message && <div className="flowMessage">{message}</div>}
      </section>
    </main>
  );
}


export default function ProtectPage() {
  return (
    <Suspense fallback={<main className="flowPage" />}>
      <ProtectPageContent />
    </Suspense>
  );
}
