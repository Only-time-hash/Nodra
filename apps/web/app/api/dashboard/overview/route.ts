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

  const [{ data: agents, error: agentsError }, { data: incidents, error: incidentsError }, { data: events, error: eventsError }, integrityResult] =
    await Promise.all([
      ctx.supabase
        .from("agents")
        .select("id,external_id,name,status,authority_scope,last_seen_at,created_at")
        .eq("workspace_id", ctx.workspaceId)
        .eq("kind", "customer")
        .order("created_at", { ascending: true }),
      ctx.supabase
        .from("incidents")
        .select("id,state,title,severity,opened_at,contained_at,resolved_at,metadata")
        .eq("workspace_id", ctx.workspaceId)
        .neq("state", "resolved")
        .order("opened_at", { ascending: false })
        .limit(20),
      ctx.supabase
        .from("security_events")
        .select("id,event_type,action,decision,occurred_at,sequence_no,agent_id,payload,agents!security_events_agent_id_fkey(external_id,name)")
        .eq("workspace_id", ctx.workspaceId)
        .order("sequence_no", { ascending: false })
        .limit(20),
      ctx.supabase.rpc("verify_security_event_chain", {
        p_workspace_id: ctx.workspaceId,
      }),
    ]);

  if (agentsError || incidentsError || eventsError) {
    return NextResponse.json({ error: "dashboard_query_failed" }, { status: 500 });
  }

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
    agents: agents ?? [],
    incidents: incidents ?? [],
    events: events ?? [],
    integrity,
    stats: {
      registeredAgents: (agents ?? []).length,
      healthyAgents: (agents ?? []).filter((agent: any) => agent.status === "healthy").length,
      openIncidents: (incidents ?? []).length,
      protectedPermissions: authority.size,
      recentSecurityEvents: (events ?? []).length,
    },
  });
}
