"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";


type Status = "healthy" | "at-risk" | "restricted" | "quarantined";
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
type Phase = "ready" | "incident" | "contained" | "recovering" | "resolved";
type Integrity = {valid:boolean;checkedEvents:number;firstBadSequence:number|null;reason:string|null};
type ConnectionState = "connecting" | "live" | "offline";

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
  const [phase, setPhase] = useState<Phase>("ready");
  const [events, setEvents] = useState(baseEvents);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState<any>(null);
  const [integrity, setIntegrity] = useState<Integrity|null>(null);
  const [causalEdges, setCausalEdges] = useState<Array<{from:string;to:string;relation:string}>>([]);
  const [forensicTimeline, setForensicTimeline] = useState<any[]>([]);
  const [remediating, setRemediating] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selected = useMemo(() => agents.find((agent) => agent.id === selectedId) ?? agents[0], [agents, selectedId]);
  const affected = agents.filter((agent) => agent.status !== "healthy").length;
  const selectedEdges = causalEdges.filter((edge)=>edge.from===selectedId||edge.to===selectedId);
  const hasOpenIncident = Boolean(incidentId && phase !== "resolved");
  const integrityState = !integrity ? "checking" : integrity.valid ? "verified" : "failed";
  const postureHealthy = affected === 0 && integrity?.valid === true && connection === "live";
  const postureScore = Math.max(0, 100 - affected * 20 - (integrity?.valid === false ? 25 : 0) - (connection === "offline" ? 25 : 0));

  const loadState = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/laboratory/state", { cache: "no-store" });
      if (!res.ok) throw new Error(`State refresh failed (${res.status})`);
      const state = await res.json();
      if (state.agents?.length) setAgents((current) => current.map((agent) => { const saved=state.agents.find((a:any)=>a.external_id===agent.id); return saved ? {...agent,status:saved.status === "at_risk" ? "at-risk" : saved.status} : agent; }));
      setIntegrity(state.integrity ?? null);
      setCausalEdges((state.causalEdges??[]).map((edge:any)=>({from:edge.from?.external_id,to:edge.to?.external_id,relation:edge.relation})).filter((edge:any)=>edge.from&&edge.to));
      setForensicTimeline(state.forensicTimeline ?? []);
      if (state.incident) {
        setIncidentId(state.incident.id);
        setPhase(state.incident.state === "resolved" ? "resolved" : state.incident.state === "recovering" ? "recovering" : state.incident.state === "contained" ? "contained" : "incident");
        setRecovery(state.recovery ?? null);
      } else {
        setIncidentId(null);
        setPhase("ready");
        setRecovery(null);
      }
      setEvents(state.events?.length ? [...baseEvents,...state.events.map((e:any)=>({time:new Date(e.occurred_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),kind:e.decision==="deny"?"blocked":"system",text:`${e.event_type}${e.action ? ` · ${e.action}` : ""}${e.payload?.reason ? ` — ${e.payload.reason}` : ""}`}))] : baseEvents);
      setConnection("live");
      setErrorMessage(null);
    } catch (error) {
      setConnection("offline");
      setErrorMessage(error instanceof Error ? error.message : "Nodra could not refresh security state.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState(true);
    const timer = window.setInterval(() => void loadState(false), 10000);
    const refreshOnFocus = () => void loadState(false);
    window.addEventListener("focus", refreshOnFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refreshOnFocus); };
  }, [loadState]);

  async function requireSuccess(response: Response, fallback: string) {
    if (response.ok) return;
    const body = await response.json().catch(() => null);
    const message = body?.error ? `${fallback}: ${body.error}` : `${fallback} (${response.status})`;
    setErrorMessage(message);
    throw new Error(message);
  }

  async function runIncident() {
    if (phase !== "ready") return;
    setErrorMessage(null);
    const response = await fetch("/api/laboratory/incident",{method:"POST"});
    await requireSuccess(response, "Incident creation failed");
    const result = await response.json();
    setIncidentId(result.incidentId);
    setPhase("incident");
    setAgents((current) => current.map((agent) => result.affectedAgentIds.includes(agent.id) ? { ...agent, status: "at-risk" } : agent));
    setSelectedId("research");
    await loadState(false);
    setEvents((current) => [
      ...current,
      { time: "00:08", kind: "risk", text: "Research consumed untrusted sandbox content." },
      { time: "00:09", kind: "risk", text: "Research attempted an action outside its explicit authority." },
      { time: "00:09", kind: "blocked", text: `Policy gateway decision: ${result.attemptedAction.decision}. ${result.attemptedAction.reason}` },
      { time: "00:10", kind: "trace", text: "Causal paths traced: Research → Manager → Finance and Data. Support remains outside the affected branch." },
    ]);
  }

  async function containIncident() {
    if (phase !== "incident") return;
    if (!incidentId) return;
    const response = await fetch("/api/laboratory/contain",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({incidentId})});
    await requireSuccess(response, "Containment failed");
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
    await loadState(false);
  }

  async function beginRecovery() {
    if (!incidentId) return;
    const res=await fetch("/api/laboratory/recovery",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({incidentId})});
    await requireSuccess(res, "Recovery preparation failed"); const data=await res.json(); setRecovery(data); setPhase("recovering"); await loadState(false);
  }

  async function runRemediation(actionType:string,target:string) {
    if(!incidentId||remediating) return; setRemediating(actionType);
    try { const res=await fetch("/api/laboratory/remediate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({incidentId,actionType,target})}); await requireSuccess(res, "Remediation failed"); const data=await res.json(); setRecovery((r:any)=>({...r,restart_checks:data.restartChecks,restartChecks:data.restartChecks,safe_to_restart:data.safeToRestart})); await loadState(false); } catch(error) { setErrorMessage(error instanceof Error ? error.message : "Remediation failed."); } finally { setRemediating(null); }
  }

  async function updateRestartCheck(key:string,value:boolean) {
    if(!incidentId) return;
    const res=await fetch("/api/laboratory/restart",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({incidentId,checks:{[key]:value}})});
    await requireSuccess(res, "Restart assessment failed"); const data=await res.json(); setRecovery((r:any)=>({...r,restart_checks:data.restartChecks,safe_to_restart:data.safeToRestart})); if(data.safeToRestart) setPhase("resolved"); await loadState(false);
  }

  async function resetLab() {
    const res=await fetch("/api/laboratory/reset",{method:"POST"});
    await requireSuccess(res, "Laboratory reset failed");
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
        <Link className="labBrand" href="/" aria-label="Nodra home"><span className="armadilloMark" aria-hidden="true"><i className="shellSeg s1"/><i className="shellSeg s2"/><i className="shellSeg s3"/><i className="shellSeg s4"/><b/></span><span className="brandCopy"><strong>NODRA</strong><small>The Shield for Agentic AI</small></span></Link>
        <p className="workspace">AGENTIC AI SHIELD</p>
        <nav className="sideNav" aria-label="Nodra application">
          <a className="active" href="#dashboard">⌂ <span>Dashboard</span></a>
          <a href="#network">⌘ <span>Network</span></a>
          <a href="#agents">◎ <span>Agents</span></a>
          <a href="#incidents">△ <span>Incidents</span>{affected > 0 ? <b>{affected}</b> : null}</a>
          <a href="#activity">≋ <span>Activity</span></a>
          <a href="#policies">◇ <span>Policies</span></a>
          <a href="#credentials">▱ <span>Credentials</span></a>
          <a href="#containment">⬡ <span>Containment</span></a>
          <a href="#recovery">↻ <span>Recovery</span></a>
          <a href="#reports">▥ <span>Reports</span></a>
          <a href="#settings">⚙ <span>Settings</span></a>
        </nav>
        <div className="labScope"><strong>Nodra Shield</strong><p>Containment, provenance and recovery controls for autonomous agents.</p></div>
      </aside>

      <section className="labMain">
        <div className="commandTopbar"><label className="commandSearch"><span>⌕</span><input aria-label="Search Nodra" placeholder="Search agents, incidents, events..." /></label><div className="topbarStatus"><span className={"liveIndicator "+connection}><i/> {connection === "live" ? "LIVE" : connection === "connecting" ? "CONNECTING" : "OFFLINE"}</span><span>V0.1</span></div></div>
        {errorMessage ? <div className="dashboardError" role="alert"><span>{errorMessage}</span><button type="button" onClick={()=>void loadState(true)}>Retry</button></div> : null}
        <header className="labHeader">
          <div id="dashboard"><p>NODRA / SECURITY OVERVIEW</p><h1>Your Agentic AI, <span className="accentText">Protected.</span></h1><p className="dashboardSub">Prevent threats. Contain risks. Preserve trusted autonomy.</p></div>
          <div className="headerActions">
            <span className={"phase " + phase}><i />{phase === "ready" ? "All systems healthy" : phase === "incident" ? "Incident active" : phase === "contained" ? "Incident contained" : phase === "recovering" ? "Recovery required" : "Safe restart verified"}</span>
            <button className="ghostBtn" onClick={resetLab}>Reset</button>
          </div>
        </header>

        <section className="shieldStats" aria-label="Nodra security overview">
          <article><span className="statIcon healthy">◆</span><div><strong>{agents.filter(a=>a.status==="healthy").length}</strong><p>Agents Online</p><small>{agents.length} agents registered</small></div></article>
          <article><span className="statIcon danger">△</span><div><strong>{hasOpenIncident ? 1 : 0}</strong><p>Open Incidents</p><small>{hasOpenIncident ? phase : "No active incident"}</small></div></article>
          <article><span className="statIcon protectedIcon">⬡</span><div><strong>{agents.reduce((n,a)=>n+a.tools.length,0)}</strong><p>Protected Resources</p><small>Tools and runtime surfaces</small></div></article>
          <article><span className="statIcon events">◷</span><div><strong>{Math.max(events.length-baseEvents.length,0)}</strong><p>Security Events</p><small>Flight Recorder evidence</small></div></article>
          <article><span className={"statIcon "+(integrityState === "verified" ? "healthy" : integrityState === "failed" ? "danger" : "events")}>{integrityState === "verified" ? "✓" : integrityState === "failed" ? "!" : "…"}</span><div><strong>{integrityState === "verified" ? "100%" : integrityState === "failed" ? "FAILED" : "—"}</strong><p>Evidence Integrity</p><small>{integrityState === "verified" ? "Hash chain verified" : integrityState === "failed" ? integrity?.reason ?? "Verification failed" : "Verification in progress"}</small></div></article>
        </section>

        <section className="commandGrid">
          <article className="commandCard postureCard">
            <div className="commandTitle"><div><strong>Security Posture</strong><small>Verified protection state</small></div><span className={postureHealthy ? "postureGood" : "postureRisk"}>{postureHealthy ? "Protected" : "Attention"}</span></div>
            <div className="postureBody"><div className={"postureRing "+(postureHealthy?"good":"risk")}><strong>{postureScore}</strong><span>/100</span></div><div className="postureChecks"><p><i /> Runtime connection {connection}</p><p><i /> Flight Recorder {connection === "live" ? "reachable" : "unavailable"}</p><p><i /> Evidence chain {integrityState}</p><p><i /> Containment state {phase}</p></div></div>
          </article>
          <article className="commandCard containmentCard" id="containment">
            <div className="commandTitle"><div><strong>Containment Status</strong><small>Blast-radius control</small></div><span className={"containmentBadge "+phase}>{phase === "ready" || phase === "resolved" ? "Standby" : phase}</span></div>
            <div className="containmentRows"><p><span>Quarantined</span><strong>{agents.filter(a=>a.status==="quarantined").length}</strong></p><p><span>Restricted / at risk</span><strong>{agents.filter(a=>a.status==="restricted"||a.status==="at-risk").length}</strong></p><p><span>Healthy</span><strong>{agents.filter(a=>a.status==="healthy").length}</strong></p></div>
            <small className="containmentNote">{phase==="incident" ? "Propagation detected. Selective containment is available." : phase==="contained"||phase==="recovering" ? "Affected authority has been reduced while healthy agents remain available." : "No active containment action required."}</small>
          </article>
        </section>

        <div className="labGrid">
          <section className="canvasPanel" id="network">
            <div className="panelTop">
              <div><strong>Agent Network</strong><span>Live authority, trust and propagation paths</span></div>
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
              <div className="canvasHint"><span className="canvasLive"><i/> LIVE NETWORK</span> Select an agent to inspect authority, tools, and containment state.</div>
            </div>
            <div className="incidentBar" id="incidents">
              <div><span className="shield">◇</span><p><strong>{phase === "ready" ? "Controlled incident scenario ready" : phase === "incident" ? "Potential propagation detected" : "Affected branch isolated"}</strong><small>{phase === "ready" ? "Simulate untrusted content reaching the Research agent." : phase === "incident" ? "Nodra traced the observable causal path and blocked an unauthorized action." : "Research is quarantined. Manager, Finance and Data have restricted authority; Support remains healthy and available."}</small></p></div>
              {phase === "ready" ? <button className="runBtn" onClick={runIncident} disabled={loading}>{loading ? "Loading state…" : "Run controlled incident"}</button> : phase === "incident" ? <button className="containBtn" onClick={containIncident}>Contain incident</button> : phase === "contained" ? <button className="runBtn" onClick={beginRecovery}>Prepare recovery</button> : phase === "resolved" ? <button className="runBtn" onClick={resetLab}>Run again</button> : null}
            </div>
          </section>

          <aside className="inspector" id="agents">
            <div className="inspectorHead"><p>AGENT INSPECTOR</p><span className={"statusPill " + selected.status}>{selected.status.replace("-", " ")}</span></div>
            <div className="identity"><span className={"bigIcon "+selected.status}>{selected.name[0]}</span><div><h2>{selected.name}</h2><p>{selected.role}</p></div></div>
            <div className="agentTrust"><span><small>TRUST STATE</small><strong>{selected.status==="healthy" ? "Trusted" : selected.status==="quarantined" ? "Isolated" : "Reduced"}</strong></span><span><small>TOOLS</small><strong>{selected.tools.length}</strong></span><span><small>PERMISSIONS</small><strong>{selected.permissions.length}</strong></span></div>
            <div className="inspectSection"><p className="label">TOOLS</p>{selected.tools.map((tool) => <div className="row" key={tool}><span>{tool}</span><b>connected</b></div>)}</div>
            <div className="inspectSection" id="policies"><p className="label">EXPLICIT PERMISSIONS</p>{selected.permissions.map((permission) => <code key={permission}>{permission}</code>)}</div>
            <div className="inspectSection"><p className="label">AUTHORITY</p><div className="authority"><span>Delegated by</span><strong>{selected.id === "manager" ? "Human" : "Manager"}</strong></div><div className="authority"><span>Execution state</span><strong>{selected.status === "healthy" ? "Normal" : selected.status === "quarantined" ? "Blocked" : "Restricted"}</strong></div><div className="authority"><span>Blast-radius membership</span><strong>{selected.status === "healthy" ? "Outside affected branch" : "Affected"}</strong></div></div>
            <div className="inspectSection"><p className="label">CAUSAL RELATIONSHIPS</p>{selectedEdges.length ? selectedEdges.map((edge,index)=><div className="row" key={edge.from+"-"+edge.to+"-"+index}><span>{edge.from} → {edge.to}</span><b>{edge.relation}</b></div>) : <div className="row"><span>No persisted incident edge</span><b>clean</b></div>}</div>
            {selected.status === "quarantined" ? <div className="quarantineNote"><strong>Quarantine active</strong><p>New tool actions and delegated authority are blocked pending recovery review.</p></div> : null}
          </aside>
        </div>

        <section className="controlStrip">
          <article id="credentials"><div><span className="controlIcon">▱</span><p><strong>Credentials</strong><small>Scoped runtime authority</small></p></div><b className={affected ? "warnText" : "okText"}>{affected ? "Review" : "Protected"}</b></article>
          <article id="policy-status"><div><span className="controlIcon">◇</span><p><strong>Policy Gateway</strong><small>Deterministic enforcement</small></p></div><b className={connection === "live" ? "okText" : "warnText"}>{connection === "live" ? "Reachable" : "Unavailable"}</b></article>
          <article id="reports"><div><span className="controlIcon">▥</span><p><strong>Evidence</strong><small>Tamper-evident event chain</small></p></div><b className={integrityState === "verified" ? "okText" : integrityState === "failed" ? "warnText" : "neutralText"}>{integrityState}</b></article>
          <article id="settings"><div><span className="controlIcon">⚙</span><p><strong>Runtime</strong><small>Five-agent protected environment</small></p></div><b className={connection === "live" ? "okText" : "warnText"}>{connection}</b></article>
        </section>

        <section className="dashboardLower">
          <article className="activityPanel dashboardEvents">
            <div className="activityHead"><div><strong>Recent Security Events</strong><span>Latest observable activity from the Flight Recorder</span></div><a href="#activity">View activity</a></div>
            <div className="compactEvents">{events.slice(-4).reverse().map((event,index)=><div className="compactEvent" key={index}><span className={"eventDot "+event.kind} /><div><strong>{event.kind}</strong><p>{event.text}</p></div><time>{event.time}</time></div>)}</div>
          </article>
          <article className="activityPanel dashboardIncidents">
            <div className="activityHead"><div><strong>Open Incidents</strong><span>Current response state</span></div><a href="#incidents">Investigate</a></div>
            <div className="incidentSummary">{incidentId && phase!=="resolved" ? <><div className="incidentSeverity"><span>HIGH</span><strong>{phase==="incident" ? "Propagation risk detected" : phase==="contained" ? "Affected branch contained" : "Recovery in progress"}</strong></div><p>Origin: <b>Research</b></p><p>Affected agents: <b>{affected}</b></p><p>Incident: <code>{incidentId.slice(0,8)}…</code></p></> : <div className="emptyIncident"><span>✓</span><strong>No open incidents</strong><p>Nodra is monitoring the agent network.</p></div>}</div>
          </article>
        </section>

        {phase === "recovering" && recovery ? <section className="activityPanel" id="recovery">
          <div className="activityHead"><div><strong>Safe restart assessment</strong><span>Recovery is separate from containment</span></div><span className="recording">HUMAN GATED</span></div>
          <div className="events">
            {Object.entries(recovery.restart_checks ?? recovery.restartChecks ?? {}).map(([key,value]) => { const actions:any={originPatched:["patch_origin","research-origin"],credentialsRotated:["rotate_credentials","simulated-credentials"],memoryReviewed:["review_memory","research-state"],pendingJobsReviewed:["cancel_pending_jobs","delegated-jobs"]}; const action=actions[key]; return <div className="event" key={key}><input type="checkbox" checked={Boolean(value)} readOnly disabled={key!=="humanApproved"} onChange={(e)=>key==="humanApproved"&&updateRestartCheck(key,e.target.checked)} /><p><strong>{key.replace(/([A-Z])/g," $1")}</strong><small>{key==="humanApproved" ? "Owner/Admin approval" : Boolean(value) ? "Verified by successful Nodra laboratory remediation evidence" : "Waiting for Nodra remediation evidence"}</small></p>{action&&!value ? <button className="ghostBtn" disabled={Boolean(remediating)} onClick={()=>runRemediation(action[0],action[1])}>{remediating===action[0] ? "Running…" : "Remediate"}</button> : null}</div>; })}
            {(recovery.steps ?? []).map((step:any)=><div className="event" key={step.id ?? step.title}><span className="eventKind recovery">recovery</span><p><strong>{step.title}</strong> — {step.reason}</p></div>)}
          </div>
        </section> : null}

        {incidentId ? <section className="activityPanel" id="investigation"><div className="activityHead"><div><strong>Incident Investigation</strong><span>Persisted forensic timeline · observable evidence only</span></div><div className="investigationMeta"><span className="incidentRef">{incidentId.slice(0,8)}</span><span className={"recording "+phase}>{phase.toUpperCase()}</span></div></div><div className="events"><div className="incidentFacts"><span><small>ORIGIN</small><strong>Research</strong></span><span><small>AFFECTED</small><strong>{affected}</strong></span><span><small>EVIDENCE</small><strong>{forensicTimeline.length}</strong></span><span><small>CHAIN</small><strong>{integrityState}</strong></span></div><div className="event"><span className="eventKind trace">origin</span><p><strong>Research</strong> is the recorded incident origin.</p></div>{forensicTimeline.map((item:any,index)=><div className="event" key={item.id ?? `forensic-${index}`}><span className={`eventKind ${item.kind==="containment"?"contain":item.label==="policy-decision"?"blocked":"trace"}`}>{item.kind}</span><p><strong>{item.label}</strong>{item.target ? ` · target ${item.target}` : ""} — {item.detail}<small>{item.at ? new Date(item.at).toLocaleString() : ""}{item.sequence ? ` · sequence ${item.sequence}` : ""}{item.hash ? ` · hash ${String(item.hash).slice(0,12)}…` : ""}</small></p></div>)}<div className="event"><span className={"eventKind "+(integrity?.valid?"system":"risk")}>evidence</span><p>{integrity?.valid ? `Hash chain verified across ${integrity.checkedEvents} recorded events.` : integrity ? `Evidence verification failed${integrity.reason ? `: ${integrity.reason}` : "."}` : "Evidence verification is in progress."}</p></div><div className="event"><span className="eventKind contain">state</span><p>Incident state: <strong>{phase}</strong>. Affected agents: <strong>{affected}</strong>.</p></div></div></section> : null}

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
