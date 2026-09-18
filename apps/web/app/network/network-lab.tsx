"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";


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
  const [phase, setPhase] = useState<"ready" | "incident" | "contained" | "recovering" | "resolved">("ready");
  const [events, setEvents] = useState(baseEvents);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState<any>(null);
  const [integrity, setIntegrity] = useState<{valid:boolean;checkedEvents:number;firstBadSequence:number|null;reason:string|null}|null>(null);
  const [causalEdges, setCausalEdges] = useState<Array<{from:string;to:string;relation:string}>>([]);
  const [forensicTimeline, setForensicTimeline] = useState<any[]>([]);

  const selected = useMemo(() => agents.find((agent) => agent.id === selectedId) ?? agents[0], [agents, selectedId]);
  const affected = agents.filter((agent) => agent.status !== "healthy").length;
  const selectedEdges = causalEdges.filter((edge)=>edge.from===selectedId||edge.to===selectedId);

  useEffect(() => {
    fetch("/api/laboratory/state").then(async (res) => {
      if (!res.ok) return;
      const state = await res.json();
      if (state.agents?.length) setAgents((current) => current.map((agent) => { const saved=state.agents.find((a:any)=>a.external_id===agent.id); return saved ? {...agent,status:saved.status === "at_risk" ? "at-risk" : saved.status} : agent; }));
      if (state.integrity) setIntegrity(state.integrity);
      if (state.causalEdges) setCausalEdges(state.causalEdges.map((edge:any)=>({from:edge.from?.external_id,to:edge.to?.external_id,relation:edge.relation})).filter((edge:any)=>edge.from&&edge.to));
      if (state.forensicTimeline) setForensicTimeline(state.forensicTimeline);
      if (state.incident) { setIncidentId(state.incident.id); setPhase(state.incident.state === "resolved" ? "resolved" : state.incident.state === "recovering" ? "recovering" : state.incident.state === "contained" ? "contained" : "incident"); setRecovery(state.recovery ?? null); }
      if (state.events?.length) setEvents([...baseEvents,...state.events.map((e:any)=>({time:new Date(e.occurred_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),kind:e.decision==="deny"?"blocked":"system",text:`${e.event_type}${e.action ? ` · ${e.action}` : ""}${e.payload?.reason ? ` — ${e.payload.reason}` : ""}`}))]);
    }).finally(()=>setLoading(false));
  }, []);

  async function runIncident() {
    if (phase !== "ready") return;
const response = await fetch("/api/laboratory/incident",{method:"POST"});
    if (!response.ok) return;
    const result = await response.json();
    setIncidentId(result.incidentId);
    setPhase("incident");
    setAgents((current) => current.map((agent) => result.affectedAgentIds.includes(agent.id) ? { ...agent, status: "at-risk" } : agent));
    setSelectedId("research");
    const refreshed=await fetch("/api/laboratory/state"); if(refreshed.ok){const state=await refreshed.json(); setCausalEdges((state.causalEdges??[]).map((edge:any)=>({from:edge.from?.external_id,to:edge.to?.external_id,relation:edge.relation})).filter((edge:any)=>edge.from&&edge.to)); setForensicTimeline(state.forensicTimeline??[]);}
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
    if (!incidentId) return;
    const response = await fetch("/api/laboratory/contain",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({incidentId})});
    if (!response.ok) return;
    const result = await response.json();
    const statuses = new Map<string, Status>(result.targets.map((target: { id: string; status: Status }) => [target.id, target.status]));
    setPhase("contained");
    setAgents((current) => current.map((agent) => ({ ...agent, status: statuses.get(agent.id) ?? agent.status })));
    setEvents((current) => [
      ...current,
      { time: "00:12", kind: "contain", text: "Research quarantined; delegated authority revoked." },
      { time: "00:12", kind: "contain", text: "Affected branch severed. Unaffected agents remain available." },
      { time: "00:13", kind: "recovery", text: "Recovery review prepared for Research state and sandbox notes." },
    ]);
  }

  async function beginRecovery() {
    if (!incidentId) return;
    const res=await fetch("/api/laboratory/recovery",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({incidentId})});
    if(!res.ok) return; const data=await res.json(); setRecovery(data); setPhase("recovering");
  }

  async function updateRestartCheck(key:string,value:boolean) {
    if(!incidentId) return;
    const res=await fetch("/api/laboratory/restart",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({incidentId,checks:{[key]:value}})});
    if(!res.ok) return; const data=await res.json(); setRecovery((r:any)=>({...r,restart_checks:data.restartChecks,safe_to_restart:data.safeToRestart})); if(data.safeToRestart) setPhase("resolved");
  }

  async function resetLab() {
    const res=await fetch("/api/laboratory/reset",{method:"POST"});
    if(!res.ok) return;
    setAgents(initialAgents);
    setSelectedId("manager");
    setPhase("ready");
    setEvents(baseEvents);
    setIncidentId(null);
    setRecovery(null);
    setIntegrity(null);
    setCausalEdges([]);
    setForensicTimeline([]);
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
            <span className={"phase " + phase}><i />{phase === "ready" ? "All systems healthy" : phase === "incident" ? "Incident active" : phase === "contained" ? "Incident contained" : phase === "recovering" ? "Recovery required" : "Safe restart verified"}</span>
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
                {causalEdges.map((edge,index)=>{ const from=agents.find(a=>a.id===edge.from); const to=agents.find(a=>a.id===edge.to); if(!from||!to) return null; const x1=from.x*10,y1=from.y*6,x2=to.x*10,y2=to.y*6; const affectedEdge=from.status!=="healthy"||to.status!=="healthy"; return <path key={edge.from+"-"+edge.to+"-"+index} d={`M${x1} ${y1} L${x2} ${y2}`} className={(affectedEdge?"dangerEdge ":"")+(edge.relation==="influenced"?"dashed":"")} />; })}
                {causalEdges.length===0 ? agents.filter(a=>a.id!=="manager").map((agent,index)=><path key={"baseline-"+agent.id} d={`M500 90 L${agent.x*10} ${agent.y*6}`} className={index===0&&phase!=="ready"?"dangerEdge":""} />) : null}
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
              {phase === "ready" ? <button className="runBtn" onClick={runIncident} disabled={loading}>{loading ? "Loading state…" : "Run controlled incident"}</button> : phase === "incident" ? <button className="containBtn" onClick={containIncident}>Contain incident</button> : phase === "contained" ? <button className="runBtn" onClick={beginRecovery}>Prepare recovery</button> : phase === "resolved" ? <button className="runBtn" onClick={resetLab}>Run again</button> : null}
            </div>
          </section>

          <aside className="inspector" id="agents">
            <div className="inspectorHead"><p>AGENT INSPECTOR</p><span className={"statusPill " + selected.status}>{selected.status.replace("-", " ")}</span></div>
            <div className="identity"><span className="bigIcon">{selected.name[0]}</span><div><h2>{selected.name}</h2><p>{selected.role}</p></div></div>
            <div className="inspectSection"><p className="label">TOOLS</p>{selected.tools.map((tool) => <div className="row" key={tool}><span>{tool}</span><b>connected</b></div>)}</div>
            <div className="inspectSection" id="policies"><p className="label">EXPLICIT PERMISSIONS</p>{selected.permissions.map((permission) => <code key={permission}>{permission}</code>)}</div>
            <div className="inspectSection"><p className="label">AUTHORITY</p><div className="authority"><span>Delegated by</span><strong>{selected.id === "manager" ? "Human" : "Manager"}</strong></div></div>
            <div className="inspectSection"><p className="label">CAUSAL RELATIONSHIPS</p>{selectedEdges.length ? selectedEdges.map((edge,index)=><div className="row" key={edge.from+"-"+edge.to+"-"+index}><span>{edge.from} → {edge.to}</span><b>{edge.relation}</b></div>) : <div className="row"><span>No persisted incident edge</span><b>clean</b></div>}</div>
            {selected.status === "quarantined" ? <div className="quarantineNote"><strong>Quarantine active</strong><p>New tool actions and delegated authority are blocked pending recovery review.</p></div> : null}
          </aside>
        </div>

        {phase === "recovering" && recovery ? <section className="activityPanel" id="recovery">
          <div className="activityHead"><div><strong>Safe restart assessment</strong><span>Recovery is separate from containment</span></div><span className="recording">HUMAN GATED</span></div>
          <div className="events">
            {Object.entries(recovery.restart_checks ?? recovery.restartChecks ?? {}).map(([key,value]) => <label className="event" key={key}><input type="checkbox" checked={Boolean(value)} onChange={(e)=>updateRestartCheck(key,e.target.checked)} /><p>{key.replace(/([A-Z])/g," $1")}</p></label>)}
            {(recovery.steps ?? []).map((step:any)=><div className="event" key={step.id ?? step.title}><span className="eventKind recovery">recovery</span><p><strong>{step.title}</strong> — {step.reason}</p></div>)}
          </div>
        </section> : null}

        {incidentId ? <section className="activityPanel" id="investigation"><div className="activityHead"><div><strong>Incident investigation</strong><span>Persisted forensic timeline · observable evidence only</span></div><span className="recording">{phase.toUpperCase()}</span></div><div className="events"><div className="event"><span className="eventKind trace">origin</span><p><strong>Research</strong> is the recorded laboratory incident origin.</p></div>{forensicTimeline.map((item:any,index)=><div className="event" key={item.id ?? `forensic-${index}`}><span className={`eventKind ${item.kind==="containment"?"contain":item.label==="policy-decision"?"blocked":"trace"}`}>{item.kind}</span><p><strong>{item.label}</strong>{item.target ? ` · target ${item.target}` : ""} — {item.detail}<small>{item.at ? new Date(item.at).toLocaleString() : ""}{item.sequence ? ` · sequence ${item.sequence}` : ""}{item.hash ? ` · hash ${String(item.hash).slice(0,12)}…` : ""}</small></p></div>)}<div className="event"><span className={"eventKind "+(integrity?.valid?"system":"risk")}>evidence</span><p>{integrity?.valid ? `Hash chain verified across ${integrity.checkedEvents} recorded events.` : "Evidence integrity requires verification."}</p></div><div className="event"><span className="eventKind contain">state</span><p>Incident state: <strong>{phase}</strong>. Affected agents: <strong>{affected}</strong>.</p></div></div></section> : null}

        <section className="activityPanel" id="activity">
          <div className="activityHead"><div><strong>Flight recorder</strong><span>Observable laboratory events</span></div><span className="recording"><i /> RECORDING</span></div>
          {integrity ? <div className={integrity.valid ? "quarantineNote" : "quarantineNote danger"}><strong>Evidence integrity: {integrity.valid ? "Verified" : "Failed"}</strong><p>{integrity.valid ? `${integrity.checkedEvents} recorded event${integrity.checkedEvents === 1 ? "" : "s"} verified against the tamper-evident hash chain.` : `Verification failed${integrity.firstBadSequence ? ` at sequence ${integrity.firstBadSequence}` : ""}${integrity.reason ? `: ${integrity.reason}` : "."}`}</p></div> : null}
          <div className="events">
            {events.map((event, index) => <div className="event" key={index}><time>{event.time}</time><span className={"eventKind " + event.kind}>{event.kind}</span><p>{event.text}</p></div>)}
          </div>
        </section>
      </section>
    </main>
  );
}
