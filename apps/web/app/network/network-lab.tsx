"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { simulateIncident, containLaboratoryIncident } from "../../lib/laboratory";

type Status = "healthy" | "at-risk" | "quarantined";
type Agent = {
  id: string;
  name: string;
  role: string;
  status: Status;
  x: number;
  y: number;
  tools: string[];
  permissions: string[];
};

const initialAgents: Agent[] = [
  { id: "manager", name: "Manager", role: "Orchestrator", status: "healthy", x: 50, y: 15, tools: ["Delegation", "Task Queue"], permissions: ["delegate:task", "read:status"] },
  { id: "research", name: "Research", role: "Web research", status: "healthy", x: 18, y: 52, tools: ["Sandbox Browser", "Notes"], permissions: ["browser:read", "notes:write"] },
  { id: "finance", name: "Finance", role: "Financial operations", status: "healthy", x: 39, y: 72, tools: ["Simulated Payments", "Ledger"], permissions: ["ledger:read", "payment:request"] },
  { id: "support", name: "Support", role: "Communication", status: "healthy", x: 62, y: 72, tools: ["Simulated Email"], permissions: ["email:draft"] },
  { id: "data", name: "Data", role: "Data operations", status: "healthy", x: 82, y: 52, tools: ["Sandbox Database"], permissions: ["database:read", "database:write"] },
];

const baseEvents = [
  { time: "00:00", kind: "system", text: "Laboratory initialized with five isolated agents." },
  { time: "00:01", kind: "policy", text: "Deterministic policy gateway active." },
  { time: "00:02", kind: "system", text: "Observable event recording active." },
];

export function NetworkLab() {
  const [agents, setAgents] = useState(initialAgents);
  const [selectedId, setSelectedId] = useState("manager");
  const [phase, setPhase] = useState<"ready" | "incident" | "contained">("ready");
  const [events, setEvents] = useState(baseEvents);\n  const [incidentId, setIncidentId] = useState<string | null>(null);\n  const [loading, setLoading] = useState(true);

  const selected = useMemo(() => agents.find((agent) => agent.id === selectedId) ?? agents[0], [agents, selectedId]);
  const affected = agents.filter((agent) => agent.status !== "healthy").length;\n\n  useEffect(() => {\n    fetch("/api/laboratory/state").then(async (res) => {\n      if (!res.ok) return;\n      const state = await res.json();\n      if (state.agents?.length) setAgents((current) => current.map((agent) => { const saved=state.agents.find((a:any)=>a.external_id===agent.id); return saved ? {...agent,status:saved.status === "at_risk" ? "at-risk" : saved.status} : agent; }));\n      if (state.incident) { setIncidentId(state.incident.id); setPhase(state.incident.state === "contained" || state.incident.state === "recovering" ? "contained" : "incident"); }\n      if (state.events?.length) setEvents([...baseEvents,...state.events.map((e:any)=>({time:new Date(e.occurred_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),kind:e.decision==="deny"?"blocked":"system",text:`${e.event_type}${e.action ? ` · ${e.action}` : ""}${e.payload?.reason ? ` — ${e.payload.reason}` : ""}`}))]);\n    }).finally(()=>setLoading(false));\n  }, []);

  async function runIncident() {
    if (phase !== "ready") return;
    const local = simulateIncident();\n    const response = await fetch("/api/laboratory/incident",{method:"POST"});\n    if (!response.ok) return;\n    const result = await response.json();\n    setIncidentId(result.incidentId);
    setPhase("incident");
    setAgents((current) => current.map((agent) => result.affectedAgentIds.includes(agent.id) ? { ...agent, status: "at-risk" } : agent));
    setSelectedId("research");
    setEvents((current) => [
      ...current,
      { time: "00:08", kind: "risk", text: "Research consumed untrusted sandbox content." },
      { time: "00:09", kind: "risk", text: "Research attempted an action outside its explicit authority." },
      { time: "00:09", kind: "blocked", text: `Policy gateway decision: ${result.attemptedAction.decision}. ${result.attemptedAction.reason}` },
      { time: "00:10", kind: "trace", text: "Causal path traced: Research → Manager → Finance." },
    ]);
  }

  async function containIncident() {
    if (phase !== "incident") return;
    if (!incidentId) return;\n    const response = await fetch("/api/laboratory/contain",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({incidentId})});\n    if (!response.ok) return;\n    const result = await response.json();
    const statuses = new Map(result.targets.map((target) => [target.id, target.status]));
    setPhase("contained");
    setAgents((current) => current.map((agent) => ({ ...agent, status: statuses.get(agent.id) ?? agent.status })));
    setEvents((current) => [
      ...current,
      { time: "00:12", kind: "contain", text: "Research quarantined; delegated authority revoked." },
      { time: "00:12", kind: "contain", text: "Affected branch severed. Unaffected agents remain available." },
      { time: "00:13", kind: "recovery", text: "Recovery review prepared for Research state and sandbox notes." },
    ]);
  }

  function resetLab() {
    setAgents(initialAgents);
    setSelectedId("manager");
    setPhase("ready");
    setEvents(baseEvents);\n    setIncidentId(null);
  }

  return (
    <main className="lab">
      <aside className="sidebar">
        <Link className="labBrand" href="/"><span>N</span>NODRA</Link>
        <p className="workspace">V0.1 LABORATORY</p>
        <nav className="sideNav" aria-label="Nodra application">
          <Link href="/">⌂ <span>Home</span></Link>
          <a className="active" href="#network">⌘ <span>Network</span></a>
          <a href="#agents">◎ <span>Agents</span></a>
          <a href="#incidents">△ <span>Incidents</span>{affected > 0 ? <b>{affected}</b> : null}</a>
          <a href="#activity">≋ <span>Activity</span></a>
          <a href="#policies">◇ <span>Policies</span></a>
        </nav>
        <div className="labScope"><strong>Sandbox only</strong><p>This laboratory uses simulated resources. It does not attack external systems.</p></div>
      </aside>

      <section className="labMain">
        <header className="labHeader">
          <div><p>NETWORK / LABORATORY</p><h1>Agent Network</h1></div>
          <div className="headerActions">
            <span className={"phase " + phase}><i />{phase === "ready" ? "All systems healthy" : phase === "incident" ? "Incident active" : "Incident contained"}</span>
            <button className="ghostBtn" onClick={resetLab}>Reset</button>
          </div>
        </header>

        <div className="labGrid">
          <section className="canvasPanel" id="network">
            <div className="panelTop">
              <div><strong>Authority graph</strong><span>5 agents · 5 simulated resources</span></div>
              <div className="legend"><i />Healthy <i className="warn" />At risk <i className="isolated" />Quarantined</div>
            </div>
            <div className="canvas">
              <svg className="edges" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
                <path d="M500 120 L180 310" className={phase === "ready" ? "" : "dangerEdge"} />
                <path d="M500 120 L390 430" className={phase === "incident" ? "dangerEdge" : ""} />
                <path d="M500 120 L620 430" />
                <path d="M500 120 L820 310" />
                <path d="M180 310 L390 430" className={phase === "incident" ? "dangerEdge dashed" : "dashed"} />
              </svg>
              <div className="humanNode">Human authority</div>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  className={"agentNode " + agent.status + (selectedId === agent.id ? " selected" : "")}
                  style={{ left: agent.x + "%", top: agent.y + "%" }}
                  onClick={() => setSelectedId(agent.id)}
                >
                  <span className="agentIcon">{agent.name.slice(0, 1)}</span>
                  <span><strong>{agent.name}</strong><small>{agent.role}</small></span>
                  <i />
                </button>
              ))}
              <div className="canvasHint">Select an agent to inspect its authority, tools, and state.</div>
            </div>
            <div className="incidentBar" id="incidents">
              <div><span className="shield">◇</span><p><strong>{phase === "ready" ? "Controlled incident scenario ready" : phase === "incident" ? "Potential propagation detected" : "Affected branch isolated"}</strong><small>{phase === "ready" ? "Simulate untrusted content reaching the Research agent." : phase === "incident" ? "Nodra traced the observable causal path and blocked an unauthorized action." : "Research is quarantined. Manager, Finance, Support and Data remain available."}</small></p></div>
              {phase === "ready" ? <button className="runBtn" onClick={runIncident} disabled={loading}>{loading ? "Loading state…" : "Run controlled incident"}</button> : phase === "incident" ? <button className="containBtn" onClick={containIncident}>Contain incident</button> : <button className="runBtn" onClick={resetLab}>Run again</button>}
            </div>
          </section>

          <aside className="inspector" id="agents">
            <div className="inspectorHead"><p>AGENT INSPECTOR</p><span className={"statusPill " + selected.status}>{selected.status.replace("-", " ")}</span></div>
            <div className="identity"><span className="bigIcon">{selected.name[0]}</span><div><h2>{selected.name}</h2><p>{selected.role}</p></div></div>
            <div className="inspectSection"><p className="label">TOOLS</p>{selected.tools.map((tool) => <div className="row" key={tool}><span>{tool}</span><b>connected</b></div>)}</div>
            <div className="inspectSection" id="policies"><p className="label">EXPLICIT PERMISSIONS</p>{selected.permissions.map((permission) => <code key={permission}>{permission}</code>)}</div>
            <div className="inspectSection"><p className="label">AUTHORITY</p><div className="authority"><span>Delegated by</span><strong>{selected.id === "manager" ? "Human" : "Manager"}</strong></div></div>
            {selected.status === "quarantined" ? <div className="quarantineNote"><strong>Quarantine active</strong><p>New tool actions and delegated authority are blocked pending recovery review.</p></div> : null}
          </aside>
        </div>

        <section className="activityPanel" id="activity">
          <div className="activityHead"><div><strong>Flight recorder</strong><span>Observable laboratory events</span></div><span className="recording"><i /> RECORDING</span></div>
          <div className="events">
            {events.map((event, index) => <div className="event" key={index}><time>{event.time}</time><span className={"eventKind " + event.kind}>{event.kind}</span><p>{event.text}</p></div>)}
          </div>
        </section>
      </section>
    </main>
  );
}
