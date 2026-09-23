"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Code2,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  Network,
  Play,
  ShieldCheck,
  Terminal,
  Workflow,
} from "lucide-react";
import { NodraMark } from "../../../components/nodra-mark";

type Agent = {
  external_id: string;
  name: string;
  status: string;
  authority_scope: string[];
};

type IntegrationMethod = "javascript" | "python" | "rest" | "mcp";

const wizardSteps = [
  { label: "Register", icon: Bot },
  { label: "Authority", icon: ShieldCheck },
  { label: "Credential", icon: KeyRound },
  { label: "Choose", icon: Code2 },
  { label: "Integrate", icon: Terminal },
  { label: "Test", icon: Play },
  { label: "Protected", icon: FileCheck2 },
  { label: "Complete", icon: Check },
];

const methods: Array<{
  id: IntegrationMethod;
  label: string;
  title: string;
  description: string;
}> = [
  {
    id: "javascript",
    label: "JavaScript / TypeScript",
    title: "JavaScript / TypeScript SDK",
    description: "Use Nodra directly from a Node.js or TypeScript agent runtime.",
  },
  {
    id: "python",
    label: "Python",
    title: "Python integration",
    description: "Connect a Python agent through Nodra's protected HTTP gateway.",
  },
  {
    id: "rest",
    label: "REST API",
    title: "REST API integration",
    description: "Call Nodra from any server runtime using signed HTTP requests.",
  },
  {
    id: "mcp",
    label: "MCP",
    title: "MCP integration",
    description: "Place Nodra policy and evidence checks around MCP tool execution.",
  },
];

function snippetFor(method: IntegrationMethod, agentId: string) {
  if (method === "python") {
    return [
      "import os",
      "import requests",
      "",
      'BASE_URL = os.environ["NODRA_BASE_URL"]',
      'CREDENTIAL = os.environ["NODRA_CREDENTIAL"]',
      "",
      "response = requests.post(",
      '    f"{BASE_URL}/api/gateway/authorize",',
      '    headers={"Authorization": f"Bearer {CREDENTIAL}"},',
      "    json={",
      '        "agentId": "' + agentId + '",',
      '        "action": "payments.submit"',
      "    },",
      ")",
      "",
      "response.raise_for_status()",
      "decision = response.json()",
    ].join("\\n");
  }

  if (method === "rest") {
    return [
      "POST /api/gateway/authorize HTTP/1.1",
      "Host: your-nodra-host",
      "Authorization: Bearer $NODRA_CREDENTIAL",
      "Content-Type: application/json",
      "",
      "{",
      '  "agentId": "' + agentId + '",',
      '  "action": "payments.submit"',
      "}",
    ].join("\\n");
  }

  if (method === "mcp") {
    return [
      "{",
      '  "mcpServers": {',
      '    "nodra-protected-tools": {',
      '      "command": "your-agent-runtime",',
      '      "env": {',
      '        "NODRA_AGENT_ID": "' + agentId + '",',
      '        "NODRA_CREDENTIAL": "$NODRA_CREDENTIAL"',
      "      }",
      "    }",
      "  }",
      "}",
    ].join("\\n");
  }

  return [
    'import { Nodra } from "@nodra/sdk";',
    "",
    "const nodra = new Nodra({",
    "  baseUrl: process.env.NODRA_BASE_URL!,",
    "  credential: process.env.NODRA_CREDENTIAL!",
    "});",
    "",
    "const agent = nodra.protect({",
    '  id: "' + agentId + '"',
    "});",
  ].join("\\n");
}

export default function IntegratePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [step, setStep] = useState(0);
  const [externalId, setExternalId] = useState("finance-agent");
  const [name, setName] = useState("Finance Agent");
  const [description, setDescription] = useState(
    "Autonomous agent for invoice processing, payments, and financial reporting.",
  );
  const [environment, setEnvironment] = useState("Production");
  const [scope, setScope] = useState<string[]>([
    "invoices.read",
    "payments.create",
    "payments.submit",
  ]);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [check, setCheck] = useState<any>(null);
  const [decision, setDecision] = useState<any>(null);
  const [method, setMethod] = useState<IntegrationMethod>("javascript");

  const agent = useMemo(
    () => agents.find((item) => item.external_id === externalId) || agents[0],
    [agents, externalId],
  );

  const activeAgentId = agent?.external_id || externalId;
  const snippet = useMemo(
    () => snippetFor(method, activeAgentId),
    [method, activeAgentId],
  );

  async function load() {
    const response = await fetch("/api/integrations/agents");

    if (response.status === 401) {
      location.href = "/auth?intent=signin";
      return;
    }

    if (response.ok) {
      const json = await response.json();
      setAgents(json.agents ?? []);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const toggle = (value: string) =>
    setScope((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );

  async function register() {
    setBusy(true);
    setMsg("");

    const response = await fetch("/api/integrations/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        externalId,
        name,
        authorityScope: scope,
      }),
    });

    const json = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMsg(json.error ?? "Could not register agent");
      return;
    }

    await load();
    setStep(1);
  }

  async function saveAuthority() {
    if (!agent) {
      setStep(0);
      return;
    }

    setBusy(true);
    setMsg("");

    const response = await fetch("/api/integrations/agents", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        externalId: agent.external_id,
        authorityScope: scope,
      }),
    });

    setBusy(false);

    if (!response.ok) {
      setMsg("Could not save authority");
      return;
    }

    await load();
    setStep(2);
  }

  async function credential() {
    if (!agent) return;

    setBusy(true);
    setMsg("");

    const response = await fetch("/api/integrations/credentials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId: agent.external_id,
        label: "Primary integration",
      }),
    });

    const json = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMsg(json.error ?? "Could not create credential");
      return;
    }

    setSecret(json.secret);
  }

  async function testConnection() {
    if (!agent) return;

    setBusy(true);
    setMsg("");

    const response = await fetch("/api/integrations/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: agent.external_id }),
    });

    const json = await response.json();
    setBusy(false);
    setCheck(json);

    if (json.connected) {
      setStep(6);
    }
  }

  async function firstAction() {
    if (!agent) {
      setMsg("Register your agent first.");
      return;
    }

    setBusy(true);
    setMsg("");

    const response = await fetch("/api/integrations/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: agent.external_id }),
    });

    const json = await response.json();
    setBusy(false);
    setDecision(json);

    if (json.connected) {
      setStep(7);
    } else {
      setMsg(
        "Run your integrated agent once so Nodra receives a signed protected action.",
      );
    }
  }

  return (
    <main className="wizardPage">
      <header className="wizardTop">
        <Link className="wizardBrand" href="/" aria-label="Nodra home">
          <span className="wizardLogo" aria-hidden="true">
            <NodraMark />
          </span>
          <b>NODRA</b>
        </Link>

        <Link className="wizardHelp" href="/docs">
          <span aria-hidden="true">ⓘ</span>
          Help
        </Link>
      </header>

      <div className="wizardShell">
        <div className="wizardSteps" aria-label="Agent protection progress">
          {wizardSteps.map(({ label, icon: Icon }, index) => (
            <div
              key={label}
              className={
                index === step
                  ? "active"
                  : index < step
                    ? "done"
                    : ""
              }
            >
              <span>
                {index < step ? <Check /> : <Icon />}
              </span>
              <small>{label}</small>
              {index < wizardSteps.length - 1 && <i />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <section className="wizardCard registerStep">
            <div className="registerFields">
              <span className="wizardKicker">AGENT IDENTITY</span>
              <h1>Register Your Agent</h1>
              <p>Tell Nodra what this agent is and where it will operate.</p>

              <label>
                Agent Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="off"
                />
              </label>

              <label>
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>

              <div className="fieldRow">
                <label>
                  Agent ID
                  <input
                    value={externalId}
                    onChange={(event) => setExternalId(event.target.value)}
                    pattern="[A-Za-z0-9_-]{2,64}"
                    autoComplete="off"
                  />
                </label>

                <label>
                  Environment
                  <select
                    value={environment}
                    onChange={(event) => setEnvironment(event.target.value)}
                  >
                    <option>Production</option>
                    <option>Staging</option>
                    <option>Development</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="agentAvatar">
              <span>
                <Bot />
              </span>
              <strong>Agent identity</strong>
              <small>Protected by Nodra</small>
            </div>

            <footer>
              <Link href="/onboarding/overview">Back to overview</Link>
              <button onClick={register} disabled={busy}>
                {busy ? "Registering…" : "Next"}
                {!busy && <ChevronRight />}
              </button>
            </footer>
          </section>
        )}

        {step === 1 && (
          <section className="wizardCard authorityStep">
            <span className="wizardKicker">AUTHORITY</span>
            <h1>Define Authority</h1>
            <p>Set exactly what this agent is allowed to do.</p>

            <div className="authorityTabs">
              <b>Recommended policy</b>
              <span>Custom scope</span>
            </div>

            {[
              ["invoices.read", "Read invoices"],
              ["payments.create", "Create payments"],
              ["payments.submit", "Submit payments"],
              ["bank.accounts", "Access bank accounts"],
              ["data.export", "Export financial data"],
            ].map(([value, label]) => (
              <label className="scopeLine" key={value}>
                <input
                  type="checkbox"
                  checked={scope.includes(value)}
                  onChange={() => toggle(value)}
                />
                <strong>{label}</strong>
                <code>{value}</code>
              </label>
            ))}

            <div className="authoritySummary">
              <ShieldCheck />
              <div>
                <b>{scope.length} permissions selected</b>
                <span>
                  Nodra will reject actions outside this authority scope.
                </span>
              </div>
            </div>

            <footer>
              <button className="back" onClick={() => setStep(0)}>
                <ChevronLeft />
                Back
              </button>

              <button onClick={saveAuthority} disabled={busy || scope.length === 0}>
                {busy ? "Saving…" : "Next"}
                {!busy && <ChevronRight />}
              </button>
            </footer>
          </section>
        )}

        {step === 2 && (
          <section className="wizardCard credentialStep">
            <span className="wizardKicker">CREDENTIAL</span>
            <h1>Generate Integration Credential</h1>
            <p>
              This credential lets your server-side agent securely authenticate
              with Nodra.
            </p>

            <div className="credentialBox">
              <label>
                Agent ID
                <div className="copyField">
                  <code>{activeAgentId}</code>
                  <Clipboard />
                </div>
              </label>

              {secret ? (
                <>
                  <label>
                    Client Secret
                    <div className="copyField secretField">
                      <code>{secret}</code>
                      <button
                        type="button"
                        aria-label="Copy client secret"
                        onClick={() => navigator.clipboard.writeText(secret)}
                      >
                        <Clipboard />
                      </button>
                    </div>
                  </label>

                  <div className="secretWarning">
                    <KeyRound />
                    <div>
                      <b>Store this secret now.</b>
                      <span>
                        Nodra will not return this credential again.
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <button
                  className="credentialGenerate"
                  onClick={credential}
                  disabled={busy}
                >
                  <KeyRound />
                  {busy ? "Generating…" : "Generate Credential"}
                </button>
              )}
            </div>

            <footer>
              <button className="back" onClick={() => setStep(1)}>
                <ChevronLeft />
                Back
              </button>

              <button onClick={() => setStep(3)} disabled={!secret}>
                Next
                <ChevronRight />
              </button>
            </footer>
          </section>
        )}

        {step === 3 && (
          <section className="wizardCard integrationStep">
            <span className="wizardKicker">INTEGRATION METHOD</span>
            <h1>Choose Your Integration</h1>
            <p>Select how your agent runtime will connect to Nodra.</p>

            <div className="methodTabs" role="tablist" aria-label="Integration method">
              {methods.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={method === item.id}
                  className={method === item.id ? "selected" : ""}
                  onClick={() => setMethod(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="integrationChoice">
              <Code2 />
              <div>
                <strong>
                  {methods.find((item) => item.id === method)?.title}
                </strong>
                <p>
                  {methods.find((item) => item.id === method)?.description}
                </p>
              </div>
            </div>

            <footer>
              <button className="back" onClick={() => setStep(2)}>
                <ChevronLeft />
                Back
              </button>

              <button onClick={() => setStep(4)}>
                Continue
                <ChevronRight />
              </button>
            </footer>
          </section>
        )}

        {step === 4 && (
          <section className="wizardCard integrationStep">
            <span className="wizardKicker">RUNTIME SETUP</span>
            <h1>Integrate Nodra</h1>
            <p>
              Add Nodra to your server-side agent runtime, then run one protected
              action.
            </p>

            <div className="integrationChecklist">
              <span><Check /> Keep the credential server-side</span>
              <span><Check /> Initialize the Nodra connection</span>
              <span><Check /> Identify the protected agent</span>
              <span><Check /> Route consequential actions through Nodra</span>
            </div>

            <div className="codeLabel">
              <span>{methods.find((item) => item.id === method)?.label}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(snippet)}
              >
                <Clipboard />
                Copy
              </button>
            </div>

            <pre>{snippet}</pre>

            <small className="releaseNote">
              Never expose the Nodra credential in browser code or a public
              repository.
            </small>

            <footer>
              <button className="back" onClick={() => setStep(3)}>
                <ChevronLeft />
                Back
              </button>

              <button onClick={() => setStep(5)}>
                I integrated it
                <ChevronRight />
              </button>
            </footer>
          </section>
        )}

        {step === 5 && (
          <section className="wizardCard testStep">
            <span className="wizardKicker">CONNECTION TEST</span>
            <h1>Test Connection</h1>
            <p>
              Nodra will verify your active credential, authority configuration,
              and recent signed runtime evidence.
            </p>

            <button
              className="testButton"
              onClick={testConnection}
              disabled={busy}
            >
              <Play />
              {busy ? "Testing…" : "Test Connection"}
            </button>

            {check && (
              <div className={check.connected ? "testResult success" : "testResult"}>
                <span>
                  {check.connected ? <Check /> : <Network />}
                </span>

                <div>
                  <strong>
                    {check.connected
                      ? "Connection successful"
                      : "Waiting for protected runtime"}
                  </strong>
                  <p>{check.message}</p>
                </div>
              </div>
            )}

            <div className="checkGrid">
              <span>
                <ShieldCheck />
                <b>Credential</b>
                {check?.checks?.activeCredential ? "Verified" : "Waiting"}
              </span>
              <span>
                <KeyRound />
                <b>Credential use</b>
                {check?.checks?.credentialUsed ? "Verified" : "Waiting"}
              </span>
              <span>
                <FileCheck2 />
                <b>Runtime evidence</b>
                {check?.checks?.runtimeEvidence ? "Verified" : "Waiting"}
              </span>
              <span>
                <LockKeyhole />
                <b>Authority</b>
                {check?.checks?.authorityConfigured ? "Configured" : "Waiting"}
              </span>
            </div>

            <footer>
              <button className="back" onClick={() => setStep(4)}>
                <ChevronLeft />
                Back
              </button>

              <button onClick={() => setStep(6)} disabled={!check?.connected}>
                Next
                <ChevronRight />
              </button>
            </footer>
          </section>
        )}

        {step === 6 && (
          <section className="wizardCard protectedStep">
            <span className="wizardKicker">PROTECTED ACTION</span>
            <h1>Send First Protected Action</h1>
            <p>
              Confirm your real integrated agent has produced protected runtime
              evidence and a Nodra decision.
            </p>

            <div className="protectedAction">
              <Workflow />
              <div>
                <strong>{agent?.name || name}</strong>
                <span>
                  Authority → signed request → Nodra decision → evidence
                </span>
              </div>
            </div>

            <button
              className="testButton"
              onClick={firstAction}
              disabled={busy}
            >
              <FileCheck2 />
              {busy ? "Verifying…" : "Verify Protected Action"}
            </button>

            {decision && (
              <div
                className={
                  decision.connected ? "testResult success" : "testResult"
                }
              >
                <span>
                  {decision.connected ? <Check /> : <Network />}
                </span>
                <div>
                  <strong>
                    {decision.connected
                      ? "Protected action verified"
                      : "No recent protected action yet"}
                  </strong>
                  <p>{decision.message}</p>
                </div>
              </div>
            )}

            <footer>
              <button className="back" onClick={() => setStep(5)}>
                <ChevronLeft />
                Back
              </button>

              <button
                onClick={() => setStep(7)}
                disabled={!decision?.connected}
              >
                Complete setup
                <ChevronRight />
              </button>
            </footer>
          </section>
        )}

        {step === 7 && (
          <section className="wizardCard completeStep">
            <div className="successOrb">
              <Check />
            </div>

            <span className="wizardKicker">AGENT PROTECTED</span>
            <h1>Your agent is protected.</h1>
            <p>
              Nodra verified the agent credential, authority configuration, and
              recent protected runtime evidence. This agent can now enter the
              dashboard as a protected workload.
            </p>

            <div className="completeProof">
              <span><ShieldCheck /> Authority configured</span>
              <span><KeyRound /> Credential active</span>
              <span><FileCheck2 /> Runtime evidence verified</span>
            </div>

            <Link className="wizardPrimaryLink" href="/network">
              Go to Dashboard
              <ChevronRight />
            </Link>

            <button
              className="addAnotherAgent"
              onClick={() => {
                setStep(0);
                setSecret("");
                setCheck(null);
                setDecision(null);
                setExternalId("new-agent");
                setName("New Agent");
                setDescription("");
                setMethod("javascript");
              }}
            >
              Add Another Agent
            </button>
          </section>
        )}

        {msg && <div className="wizardMessage">{msg}</div>}
      </div>
    </main>
  );
}
