"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { NodraLogo } from "../components/nodra-logo";


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

const initialAgents: Agent[] = [];

function positionAgent(index:number,total:number){
  if(total<=1)return {x:50,y:22};
  const angle=-Math.PI/2+(index*Math.PI*2)/total;
  const radius=total<=4?31:36;
  return {x:50+Math.cos(angle)*radius,y:50+Math.sin(angle)*radius};
}

function curvedPath(from: Agent, to: Agent) { const mx=(from.x+to.x)/2, my=(from.y+to.y)/2, dx=to.x-from.x, dy=to.y-from.y, bend=.09; return `M${from.x} ${from.y} Q${mx-dy*bend} ${my+dx*bend} ${to.x} ${to.y}`; }

function AgentGlyph({ id }: { id: string }) {
  if (id.includes("manager")) return <svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3"/><path d="M5 20c.8-4 3.2-6 7-6s6.2 2 7 6"/><path d="M12 10v4"/></svg>;
  if (id.includes("research")) return <svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="5"/><path d="m14 14 5 5"/><path d="M7 10h6M10 7v6"/></svg>;
  if (id.includes("finance")) return <svg viewBox="0 0 24 24"><path d="M4 8h16M6 8V20M18 8V20M3 20h18M12 4 4 8h16l-8-4Z"/></svg>;
  if (id.includes("support")) return <svg viewBox="0 0 24 24"><path d="M4 6h16v10H8l-4 4V6Z"/><path d="M8 10h8M8 13h5"/></svg>;
  return <svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>;
}

const dashboardNav=[["/network","Dashboard"],["/agents","Agents"],["/network/map","Agent Network"],["/activity","Security Events"],["/incidents","Incidents"],["/reports","Risk Analysis"],["/containment","Containment"],["/recovery","Recovery"],["/approvals","Approvals"],["/credentials","Credentials"],["/integrations","Integrations"],["/settings","Settings"]];
function DashboardNavIcon({name}:{name:string}){const p:any={Dashboard:<><path d="M4 11 12 4l8 7"/><path d="M6.5 10v9h11v-9"/></>,"Agent Network":<><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h8M6 8v8M18 8v8M8 18h8"/></>,Agents:<><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/></>,Incidents:<><path d="M12 4 20 19H4L12 4Z"/></>,"Security Events":<><path d="M3 8c3-5 5 5 8 0s5 5 10 0M3 13c3-5 5 5 8 0s5 5 10 0M3 18c3-5 5 5 8 0s5 5 10 0"/></>,Approvals:<><path d="M12 3 19 6v5c0 4.5-2.8 7.8-7 10-4.2-2.2-7-5.5-7-10V6l7-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,Policies:<><path d="m12 4 7 8-7 8-7-8 7-8Z"/></>,Credentials:<><path d="M5 7h15l-2 10H3L5 7Z"/></>,Containment:<><path d="m12 4 7 4v8l-7 4-7-4V8l7-4Z"/></>,Recovery:<><path d="M6 8a7 7 0 1 1-1 7"/><path d="M6 4v5H2"/></>,"Risk Analysis":<><path d="M5 5h14v14H5zM8 5v14M11 5v14M14 5v14M17 5v14"/></>,Integrations:<><path d="M7 7h10v10H7z"/><path d="M4 12h3M17 12h3M12 4v3M12 17v3"/></>,Settings:<><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></>};return <svg viewBox="0 0 24 24" aria-hidden="true">{p[name]}</svg>}

const baseEvents: Array<{time:string;kind:string;text:string}> = [];

export function NetworkLab() {
  const [agents, setAgents] = useState(initialAgents);
  const [selectedId, setSelectedId] = useState("");
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
  const [searchQuery, setSearchQuery] = useState("");

  const selected = useMemo(() => agents.find((agent) => agent.id === selectedId) ?? agents[0] ?? {id:"",name:"No protected agent",role:"Workspace",status:"healthy" as Status,x:50,y:50,tools:[],permissions:[]}, [agents, selectedId]);
  const affected = agents.filter((agent) => agent.status !== "healthy").length;
  const selectedEdges = causalEdges.filter((edge)=>edge.from===selectedId||edge.to===selectedId);
  const hasOpenIncident = Boolean(incidentId && phase !== "resolved");
  const integrityState = !integrity ? "checking" : integrity.valid ? "verified" : "failed";
  const searchMatches = useMemo<Agent[]>(() => { const q=searchQuery.trim().toLowerCase(); if(!q) return []; return agents.filter((a: Agent)=>[a.name,a.role,a.status,...a.tools,...a.permissions].some((v: string)=>v.toLowerCase().includes(q))).slice(0,5); }, [agents,searchQuery]);
  const postureHealthy = affected === 0 && integrity?.valid === true && connection === "live";
  const postureScore = Math.max(0, 100 - affected * 20 - (integrity?.valid === false ? 25 : 0) - (connection === "offline" ? 25 : 0));

  const loadState = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/dashboard/overview", { cache: "no-store" });
      if (!res.ok) throw new Error(`Dashboard refresh failed (${res.status})`);
      const state = await res.json();
      const sourceAgents = Array.isArray(state.agents) ? state.agents : [];
      const realAgents: Agent[] = sourceAgents.map((agent:any,index:number)=>{
        const permissions = Array.isArray(agent.authority_scope)
          ? agent.authority_scope.map(String)
          : agent.authority_scope && typeof agent.authority_scope === "object"
            ? Object.keys(agent.authority_scope).filter((key)=>Boolean(agent.authority_scope[key]))
            : [];
        const pos=positionAgent(index,sourceAgents.length);
        return {
          id: agent.id,
          name: agent.name || agent.external_id,
          role: agent.external_id,
          status: agent.status === "at_risk" ? "at-risk" : agent.status === "paused" ? "restricted" : agent.status,
          x: pos.x,
          y: pos.y,
          tools: permissions,
          permissions,
        };
      });
      setAgents(realAgents);
      setSelectedId((current)=>realAgents.some((agent)=>agent.id===current)?current:(realAgents[0]?.id??""));
      setIntegrity(state.integrity ?? null);
      setCausalEdges([]);
      setForensicTimeline([]);
      const openIncident=Array.isArray(state.incidents)?state.incidents[0]:null;
      if(openIncident){
        setIncidentId(openIncident.id);
        setPhase(openIncident.state === "resolved" ? "resolved" : openIncident.state === "recovering" ? "recovering" : openIncident.state === "contained" ? "contained" : "incident");
      }else{
        setIncidentId(null);
        setPhase("ready");
      }
      setRecovery(null);
      const realEvents=(state.events??[]).map((event:any)=>({
        time:new Date(event.occurred_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),
        kind:event.decision==="deny"?"blocked":event.decision==="require_approval"?"policy":"system",
        text:`${event.agents?.name??"Nodra"} · ${event.action??event.event_type}${event.decision?` · ${String(event.decision).replace("_"," ")}`:""}`,
      }));
      setEvents(realEvents);
      setConnection("live");
      setErrorMessage(null);
    } catch (error) {
      setConnection("offline");
      setErrorMessage(error instanceof Error ? error.message : "Nodra could not refresh workspace security state.");
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
    setAgents([]);
    setSelectedId("");
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
        <Link className="labBrand exactBrand" href="/network" aria-label="Nodra dashboard"><NodraLogo className="workspaceNodraLogo"/><span className="consoleBrandWord">Nodra</span></Link>
        <p className="workspace">AGENTIC AI SHIELD</p>
        <nav className="sideNav" aria-label="Nodra application">
          {dashboardNav.map(([href,label])=><Link key={href} className={href==="/network"?"active":""} href={href}><i><DashboardNavIcon name={label}/></i><span>{label}</span>{label==="Incidents"&&affected>0?<b>{affected}</b>:null}</Link>)}
        </nav>
        <div className="labScope"><strong>Nodra Shield</strong><p>Containment, provenance and recovery controls for autonomous agents.</p></div>
      </aside>

      <section className="labMain">
        <div className="commandTopbar"><label className="commandSearch"><span>⌕</span><input aria-label="Search Nodra" placeholder="Search agents, incidents, events..." value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"&&searchMatches[0]){setSelectedId(searchMatches[0].id);document.getElementById("agents")?.scrollIntoView({behavior:"smooth"});}}} /></label><div className="topbarStatus"><span className={"liveIndicator "+connection}><i/> {connection === "live" ? "LIVE" : connection === "connecting" ? "CONNECTING" : "OFFLINE"}</span><span>V0.1</span></div></div>
        {searchQuery.trim() ? <div className="searchResults" role="listbox" aria-label="Search results">{searchMatches.length ? searchMatches.map(a=><button key={a.id} type="button" onClick={()=>{setSelectedId(a.id);setSearchQuery("");document.getElementById("agents")?.scrollIntoView({behavior:"smooth"});}}><strong>{a.name}</strong><span>{a.role} · {a.status}</span></button>) : <span>No matching agents</span>}</div> : null}
        {errorMessage ? <div className="dashboardError" role="alert"><span>{errorMessage}</span><button type="button" onClick={()=>void loadState(true)}>Retry</button></div> : null}
        <header className="labHeader">
          <div id="dashboard"><p>NODRA / SECURITY OVERVIEW</p><h1>Your Agentic AI, <span className="accentText">Protected.</span></h1><p className="dashboardSub">Prevent threats. Contain risks. Preserve trusted autonomy.</p></div>
          <div className="headerActions"><Link className="ghostBtn addAgentBtn" href="/onboarding/integrate">+ Add Agent</Link>
            <span className={"phase " + phase}><i />{phase === "ready" ? "All systems healthy" : phase === "incident" ? "Incident active" : phase === "contained" ? "Incident contained" : phase === "recovering" ? "Recovery required" : "Safe restart verified"}</span>
            
          </div>
        </header>

        <section className="shieldStats" aria-label="Nodra security overview">
          <article><span className="statIcon healthy" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 19 10 12 17 5 10 12 3Z"/></svg></span><div><strong>{agents.filter(a=>a.status==="healthy").length}</strong><p>Agents Online</p><small>{agents.length} total registered</small></div></article>
          <article><span className="statIcon danger" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 4 20 19H4L12 4Z"/><path d="M12 9V14"/><path d="M12 17.2V17.3"/></svg></span><div><strong>{hasOpenIncident ? 1 : 0}</strong><p>Open Incidents</p><small>{hasOpenIncident ? phase : "No active threats"}</small></div></article>
          <article><span className="statIcon protectedIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="6.5" y="10" width="11" height="9" rx="2"/><path d="M9 10V7.5a3 3 0 0 1 6 0V10"/></svg></span><div><strong>{agents.reduce((n,a)=>n+a.tools.length,0)}</strong><p>Protected Permissions</p><small>Explicit authority scopes</small></div></article>
          <article><span className="statIcon events securityEventsIcon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5.5" y="5.5" width="13" height="13" rx="2.25"/><path d="M8.5 4v3M15.5 4v3M8.5 10.5h7M8.5 14h4.5"/></svg></span><div><strong>{Math.max(events.length-baseEvents.length,0)}</strong><p>Security Events</p><small>Last 24 hours</small></div></article>
          <article><span className={"statIcon "+(integrityState === "verified" ? "integrityIcon" : integrityState === "failed" ? "danger" : "events")} aria-hidden="true"><svg viewBox="0 0 24 24">{integrityState === "verified" ? <path d="m5 12 4 4 10-10"/> : integrityState === "failed" ? <><path d="M12 4 20 19H4L12 4Z"/><path d="M12 9V14"/></> : <path d="M12 5v7l4 2"/>}</svg></span><div><strong>{integrityState === "verified" ? "100%" : integrityState === "failed" ? "FAILED" : "—"}</strong><p>Evidence Integrity</p><small>{integrityState === "verified" ? "Hash chain verified" : integrityState === "failed" ? integrity?.reason ?? "Verification failed" : "Verification in progress"}</small></div></article>
        </section>

        <section className="dashboardReferenceNetwork">
          <div className="dashboardNetworkHead"><div><strong>Protected Agent Network</strong><span>Real customer agents and their current authority</span></div><div className="legend"><i />Healthy <i className="warn" />At risk <i className="isolated" />Quarantined</div></div>
          <div className="dashboardNetworkGrid"><div className="dashboardOrbital"><svg className="dashboardOrbitalEdges" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="18" className="orbitRing"/><circle cx="50" cy="50" r="28" className="orbitRing"/><circle cx="50" cy="50" r="38" className="orbitRing"/>{agents.map((agent,index)=><path key={agent.id} d={`M50 50 Q${(50+agent.x)/2} ${(50+agent.y)/2-3} ${agent.x} ${agent.y}`} className={"dashPath "+(agent.status==="healthy"?"dashPathHealthy":"dashPathRisk")}/>)}</svg><div className="dashboardCore"><NodraLogo className="dashboardCoreLogo"/></div>{agents.map(agent=><button key={agent.id} className={"dashboardOrbAgent dashboardOrbAgent-"+agent.id+" "+agent.status+(selectedId===agent.id?" selected":"")} style={{left:agent.x+"%",top:agent.y+"%"}} onClick={()=>setSelectedId(agent.id)}><span><AgentGlyph id={agent.role.toLowerCase()}/></span><strong>{agent.name}</strong><small>{agent.status}</small></button>)}</div><aside className="dashboardAgentCard"><div className="identity"><span className={"bigIcon inspectorAgentIcon agentIcon-"+selected.id+" "+selected.status}><AgentGlyph id={selected.role.toLowerCase()}/></span><div><h2>{selected.name}</h2><p>{selected.role}</p></div></div><div className="agentTrust"><span><small>STATUS</small><strong>{selected.status}</strong></span><span><small>AUTHORITY</small><strong>{selected.permissions.length}</strong></span></div><div className="inspectSection"><p className="label">PERMISSIONS</p>{selected.permissions.map(p=><code key={p}>{p}</code>)}</div><div className="dashboardAgentActions"><Link href="/activity">View Logs</Link><Link href="/agents">Manage Agent</Link></div></aside></div>
        </section>

        <section className="controlStrip">
          <article id="credentials"><div><span className="controlIcon">▱</span><p><strong>Credentials</strong><small>Scoped runtime authority</small></p></div><b className={affected ? "warnText" : "okText"}>{affected ? "Review" : "Protected"}</b></article>
          <article id="policy-status"><div><span className="controlIcon">◇</span><p><strong>Policy Gateway</strong><small>Deterministic enforcement</small></p></div><b className={connection === "live" ? "okText" : "warnText"}>{connection === "live" ? "Reachable" : "Unavailable"}</b></article>
          <article id="reports"><div><span className="controlIcon">▥</span><p><strong>Evidence</strong><small>Tamper-evident event chain</small></p></div><b className={integrityState === "verified" ? "okText" : integrityState === "failed" ? "warnText" : "neutralText"}>{integrityState}</b></article>
          <article id="settings"><div><span className="controlIcon">⚙</span><p><strong>Runtime</strong><small>Live protected workspace</small></p></div><b className={connection === "live" ? "okText" : "warnText"}>{connection}</b></article>
        </section>

        <section className="dashboardLower">
          <article className="activityPanel dashboardEvents">
            <div className="activityHead"><div><strong>Recent Security Events</strong><span>Latest observable activity from the Flight Recorder</span></div><Link href="/activity">View activity</Link></div>
            <div className="compactEvents">{events.slice(-4).reverse().map((event,index)=><div className="compactEvent" key={index}><span className={"eventDot "+event.kind} /><div><strong>{event.kind}</strong><p>{event.text}</p></div><time>{event.time}</time></div>)}</div>
          </article>
          <article className="activityPanel dashboardIncidents">
            <div className="activityHead"><div><strong>Open Incidents</strong><span>Current response state</span></div><Link href="/incidents">Investigate</Link></div>
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
