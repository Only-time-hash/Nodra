import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });
  if (!["owner", "admin"].includes(ctx.role)) {
    return NextResponse.json({ error: "insufficient_role" }, { status: 403 });
  }

  const [
    workspace,
    settings,
    agents,
    policies,
    incidents,
    events,
    credentials,
    containment,
    recoveryPlans,
    recoverySteps,
  ] = await Promise.all([
    ctx.supabase.from("workspaces").select("id,name,slug,created_at,updated_at").eq("id", ctx.workspaceId).maybeSingle(),
    ctx.supabase.from("workspace_settings").select("*").eq("workspace_id", ctx.workspaceId).maybeSingle(),
    ctx.supabase.from("agents").select("id,external_id,name,kind,status,authority_scope,metadata,last_seen_at,created_at").eq("workspace_id", ctx.workspaceId),
    ctx.supabase.from("policies").select("id,action,effect,enabled,constraints,agent_id,resource_id,created_at").eq("workspace_id", ctx.workspaceId),
    ctx.supabase.from("incidents").select("*").eq("workspace_id", ctx.workspaceId),
    ctx.supabase.from("security_events").select("id,incident_id,agent_id,event_type,action,resource_id,decision,payload,sequence_no,prev_hash,event_hash,occurred_at,recorded_at").eq("workspace_id", ctx.workspaceId).order("sequence_no"),
    ctx.supabase.rpc("list_integration_credentials"),
    ctx.supabase.from("containment_actions").select("*").eq("workspace_id", ctx.workspaceId),
    ctx.supabase.from("recovery_plans").select("*").eq("workspace_id", ctx.workspaceId),
    ctx.supabase.from("recovery_steps").select("*").eq("workspace_id", ctx.workspaceId),
  ]);

  const failures = [workspace, settings, agents, policies, incidents, events, credentials, containment, recoveryPlans, recoverySteps].filter((x: any) => x.error);
  if (failures.length) return NextResponse.json({ error: "workspace_export_failed" }, { status: 500 });

  const body = {
    exportedAt: new Date().toISOString(),
    workspace: workspace.data,
    settings: settings.data,
    agents: agents.data ?? [],
    policies: policies.data ?? [],
    incidents: incidents.data ?? [],
    securityEvents: events.data ?? [],
    credentials: credentials.data ?? [],
    containmentActions: containment.data ?? [],
    recoveryPlans: recoveryPlans.data ?? [],
    recoverySteps: recoverySteps.data ?? [],
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="nodra-workspace-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
