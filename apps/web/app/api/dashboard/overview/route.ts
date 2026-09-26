import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

export async function GET() {
  const ctx = await getWorkspaceContext();

  if (!ctx) {
    return NextResponse.json(
      { error: "authentication_or_workspace_required" },
      { status: 401 },
    );
  }

  const [{ data: agents, error: agentsError }, { data: allIncidents, error: incidentsError }, { data: events, error: eventsError }, { data: policies, error: policiesError }, { data: settings, error: settingsError }, integrityResult] =
    await Promise.all([
      ctx.supabase
        .from("agents")
        .select("id,external_id,name,status,authority_scope,last_seen_at,created_at")
        .eq("workspace_id", ctx.workspaceId)
        .eq("kind", "customer")
        .order("created_at", { ascending: true }),
      ctx.supabase
        .from("incidents")
        .select("id,state,title,severity,opened_at,contained_at,resolved_at,metadata,origin_agent_id")
        .eq("workspace_id", ctx.workspaceId)
        .order("opened_at", { ascending: false })
        .limit(100),
      ctx.supabase
        .from("security_events")
        .select("id,incident_id,event_type,action,decision,occurred_at,sequence_no,agent_id,payload,event_hash,resource_id,agents!security_events_agent_id_fkey(external_id,name)")
        .eq("workspace_id", ctx.workspaceId)
        .order("sequence_no", { ascending: false })
        .limit(100),
      ctx.supabase
        .from("policies")
        .select("id,action,effect,enabled,constraints,priority,starts_at,expires_at,created_at,agent_id,resource_id,agents(name,external_id),resources(name,external_id)")
        .eq("workspace_id", ctx.workspaceId)
        .order("created_at", { ascending: false }),
      ctx.supabase
        .from("workspace_settings")
        .select("agent_health_threshold_minutes,agent_controls,notifications")
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle(),
      ctx.supabase.rpc("verify_security_event_chain", {
        p_workspace_id: ctx.workspaceId,
      }),
    ]);

  if (agentsError || incidentsError || eventsError || policiesError || settingsError) {
    return NextResponse.json({ error: "dashboard_query_failed" }, { status: 500 });
  }

  const thresholdMinutes = Number(settings?.agent_health_threshold_minutes ?? 5);
  const thresholdMs = Math.max(1, thresholdMinutes) * 60_000;
  const nowMs = Date.now();
  const effectiveAgents = (agents ?? []).map((agent: any) => {
    if (agent.status !== "healthy") return agent;
    const lastSeen = agent.last_seen_at ? Date.parse(agent.last_seen_at) : NaN;
    if (!Number.isFinite(lastSeen) || nowMs - lastSeen > thresholdMs) {
      return { ...agent, status: "offline", health_reason: "stale_or_never_seen" };
    }
    return { ...agent, health_reason: "recent_runtime_activity" };
  });

  const customerAgentIds = new Set(effectiveAgents.map((agent: any) => agent.id));
  const incidents = (allIncidents ?? []).filter(
    (incident: any) =>
      incident.origin_agent_id && customerAgentIds.has(incident.origin_agent_id),
  );
  const activeIncident =
    incidents.find((incident: any) => incident.state !== "resolved") ?? null;

  const integrityError = integrityResult.error;
  const integrityRows = integrityResult.data;
  const integrityRow = Array.isArray(integrityRows) ? integrityRows[0] : integrityRows;

  const integrity = integrityError
    ? {
        valid: false,
        checkedEvents: 0,
        firstBadSequence: null,
        reason: "verification_unavailable",
      }
    : {
        valid: Boolean(integrityRow?.valid),
        checkedEvents: Number(integrityRow?.checked_events ?? 0),
        firstBadSequence: integrityRow?.first_bad_sequence ?? null,
        reason: integrityRow?.reason ?? null,
      };

  let causalEdges: any[] = [];
  let affected: any[] = [];
  let containmentActions: any[] = [];
  let recovery: any = null;
  let remediationActions: any[] = [];
  let remediationEvidence: any[] = [];
  let forensicTimeline: any[] = [];

  if (activeIncident) {
    const [
      { data: edges },
      { data: radius },
      { data: containment },
      { data: plan },
      { data: remediation },
      { data: remediationProof },
    ] = await Promise.all([
      ctx.supabase
        .from("causal_edges")
        .select("id,relation,event_id,from_agent_id,to_agent_id,from:agents!causal_edges_from_agent_id_fkey(id,external_id,name),to:agents!causal_edges_to_agent_id_fkey(id,external_id,name)")
        .eq("incident_id", activeIncident.id),
      ctx.supabase.rpc("incident_blast_radius", {
        p_incident_id: activeIncident.id,
      }),
      ctx.supabase
        .from("containment_actions")
        .select("id,action_type,target_type,target_ref,reason,executed_at")
        .eq("incident_id", activeIncident.id)
        .order("executed_at", { ascending: true }),
      ctx.supabase
        .from("recovery_plans")
        .select("id,safe_to_restart,restart_checks,approved_by,approved_at")
        .eq("incident_id", activeIncident.id)
        .maybeSingle(),
      ctx.supabase
        .from("remediation_actions")
        .select("id,action_type,target,status,started_at,completed_at,result")
        .eq("incident_id", activeIncident.id)
        .order("started_at", { ascending: true }),
      ctx.supabase
        .from("remediation_evidence")
        .select("id,check_key,evidence_type,evidence_ref,source,verified_at,adapter_action_id")
        .eq("incident_id", activeIncident.id)
        .order("verified_at", { ascending: true }),
    ]);

    causalEdges = (edges ?? []).filter(
      (edge: any) =>
        customerAgentIds.has(edge.from_agent_id) &&
        customerAgentIds.has(edge.to_agent_id),
    );
    affected = (radius ?? []).filter(
      (row: any) =>
        !row.agent_id || customerAgentIds.has(row.agent_id),
    );
    containmentActions = containment ?? [];
    remediationActions = remediation ?? [];
    remediationEvidence = remediationProof ?? [];

    if (plan) {
      const { data: steps } = await ctx.supabase
        .from("recovery_steps")
        .select("id,title,reason,requires_human,status,completed_at")
        .eq("recovery_plan_id", plan.id)
        .order("id");

      const recoverySteps = steps ?? [];
      const blockingSteps = recoverySteps.filter(
        (step: any) => !["ready", "completed"].includes(String(step.status)),
      );

      recovery = {
        ...plan,
        steps: recoverySteps,
        blockingSteps: blockingSteps.map((step: any) => ({
          id: step.id,
          title: step.title,
          status: step.status,
        })),
      };
    }

    const incidentEvents = (events ?? []).filter(
      (event: any) => event.incident_id === activeIncident.id,
    );

    forensicTimeline = [
      ...incidentEvents.map((event: any) => ({
        kind: "event",
        id: event.id,
        at: event.occurred_at,
        label: event.event_type,
        detail: event.action ?? event.decision ?? "recorded event",
        sequence: event.sequence_no,
        hash: event.event_hash,
      })),
      ...containmentActions.map((action: any) => ({
        kind: "containment",
        id: action.id,
        at: action.executed_at,
        label: action.action_type,
        detail: action.reason,
        target: action.target_ref,
      })),
      ...remediationActions.map((action: any) => ({
        kind: "remediation",
        id: action.id,
        at: action.completed_at ?? action.started_at,
        label: action.action_type,
        detail: action.status,
        target: action.target,
      })),
      ...remediationEvidence.map((proof: any) => ({
        kind: "evidence",
        id: proof.id,
        at: proof.verified_at,
        label: proof.check_key,
        detail: `${proof.evidence_type} · ${proof.source}`,
        target: proof.evidence_ref,
      })),
    ].sort((a: any, b: any) => String(a.at).localeCompare(String(b.at)));
  }

  const authority = new Set<string>();
  for (const agent of agents ?? []) {
    const scope = agent.authority_scope;
    if (Array.isArray(scope)) {
      for (const value of scope) authority.add(String(value));
    } else if (scope && typeof scope === "object") {
      for (const [key, enabled] of Object.entries(scope)) {
        if (enabled) authority.add(key);
      }
    }
  }

  return NextResponse.json({
    agents: effectiveAgents,
    incidents,
    events: events ?? [],
    policies: policies ?? [],
    incident: activeIncident,
    causalEdges,
    affected,
    containmentActions,
    remediationActions,
    remediationEvidence,
    forensicTimeline,
    recovery,
    integrity,
    workspaceSettings: settings ?? null,
    stats: {
      registeredAgents: effectiveAgents.length,
      healthyAgents: effectiveAgents.filter(
        (agent: any) => agent.status === "healthy",
      ).length,
      openIncidents: incidents.filter(
        (incident: any) => incident.state !== "resolved",
      ).length,
      protectedPermissions: authority.size,
      recentSecurityEvents: (events ?? []).length,
    },
  });
}
