import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

const RECENT_WINDOW_MS = 5 * 60 * 1000;

function isRecent(value: unknown, now: number) {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) &&
    timestamp <= now + 30_000 &&
    now - timestamp <= RECENT_WINDOW_MS;
}

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();

  if (!ctx) {
    return NextResponse.json(
      { error: "authentication_or_workspace_required" },
      { status: 401 },
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (typeof body?.agentId !== "string" || body.agentId.length > 128) {
    return NextResponse.json({ error: "agent_id_required" }, { status: 400 });
  }

  const { data, error } = await (ctx.supabase as any).rpc(
    "integration_connection_status",
    { p_workspace_id: ctx.workspaceId, p_agent_external_id: body.agentId },
  );

  if (error) {
    const message = String(error.message || "");

    if (message.includes("unknown_agent")) {
      return NextResponse.json({ error: "unknown_agent" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "connection_status_failed" },
      { status: 500 },
    );
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    return NextResponse.json({ error: "unknown_agent" }, { status: 404 });
  }

  const now = Date.now();
  const credentialUsed = isRecent(row.last_used_at, now);
  const runtimeEvidence = isRecent(row.event_occurred_at, now);
  const authorityScope = row.authority_scope;

  const authorityConfigured = Array.isArray(authorityScope)
    ? authorityScope.length > 0
    : Boolean(
        authorityScope &&
          typeof authorityScope === "object" &&
          Object.keys(authorityScope).length,
      );

  const activeCredential = Boolean(row.credential_id);
  const agentHealthy = row.agent_status === "healthy";

  const connected =
    activeCredential &&
    credentialUsed &&
    runtimeEvidence &&
    authorityConfigured &&
    agentHealthy;

  return NextResponse.json({
    connected,
    checks: {
      activeCredential,
      credentialUsed,
      runtimeEvidence,
      authorityConfigured,
      agentHealthy,
    },
    agent: {
      id: row.agent_id,
      external_id: body.agentId,
      status: row.agent_status,
      authority_scope: row.authority_scope,
    },
    lastEvent: row.event_id
      ? {
          id: row.event_id,
          occurred_at: row.event_occurred_at,
          decision: row.event_decision,
          event_type: row.event_type,
        }
      : null,
    message: connected
      ? "Signed protected runtime verified in the last five minutes."
      : "Protection is not active until a credential use and runtime evidence are both seen within the last five minutes, authority is configured, and the agent is healthy.",
  });
}
