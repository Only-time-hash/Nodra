import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../lib/persistence";

const defaults = {
  description: "",
  agent_health_threshold_minutes: 5,
  event_retention_days: 90,
  default_timezone: "UTC",
  date_format: "YYYY-MM-DD",
  theme: "dark",
  require_mfa: false,
  ip_restrictions: false,
  session_timeout_minutes: 30,
  require_strong_passwords: true,
  allow_api_access: true,
  ai_config: {},
  agent_controls: {},
  approval_policies: {},
  notifications: {
    incidentAlerts: true,
    denialAlerts: true,
    recoveryAlerts: true,
  },
  evidence_config: { exportFormat: "json" },
};

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : undefined;
}

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });

  const [{ data: workspace, error: workspaceError }, { data: settings, error: settingsError }, membersResult] =
    await Promise.all([
      ctx.supabase
        .from("workspaces")
        .select("id,name,slug,created_at,updated_at,owner_id")
        .eq("id", ctx.workspaceId)
        .maybeSingle(),
      ctx.supabase
        .from("workspace_settings")
        .select("*")
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle(),
      ctx.supabase.rpc("list_workspace_members"),
    ]);

  if (workspaceError || settingsError || membersResult.error) {
    return NextResponse.json({ error: "settings_query_failed" }, { status: 500 });
  }

  return NextResponse.json({
    workspace,
    role: ctx.role,
    userId: ctx.userId,
    settings: { ...defaults, ...(settings ?? {}) },
    members: membersResult.data ?? [],
    canManage: ["owner", "admin"].includes(ctx.role),
    canDelete: ctx.role === "owner",
  });
}

export async function PATCH(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });
  if (!["owner", "admin"].includes(ctx.role)) return NextResponse.json({ error: "insufficient_role" }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "invalid_settings" }, { status: 400 });
  }

  if (body.workspaceName !== undefined) {
    if (ctx.role !== "owner") return NextResponse.json({ error: "owner_required_for_workspace_name" }, { status: 403 });
    const workspaceName = cleanText(body.workspaceName, 120);
    if (!workspaceName || workspaceName.length < 2) return NextResponse.json({ error: "invalid_workspace_name" }, { status: 400 });

    const { error } = await ctx.supabase
      .from("workspaces")
      .update({ name: workspaceName, updated_at: new Date().toISOString() })
      .eq("id", ctx.workspaceId)
      .eq("owner_id", ctx.userId);

    if (error) return NextResponse.json({ error: "workspace_update_failed" }, { status: 500 });
  }

  const source = body.settings && typeof body.settings === "object" ? body.settings : {};
  const patch: any = { workspace_id: ctx.workspaceId, updated_at: new Date().toISOString() };

  const description = cleanText(source.description, 500);
  if (description !== undefined) patch.description = description;

  const integerFields: Array<[string, number, number]> = [
    ["agent_health_threshold_minutes", 1, 1440],
    ["event_retention_days", 1, 3650],
    ["session_timeout_minutes", 5, 1440],
  ];
  for (const [key, min, max] of integerFields) {
    if (source[key] !== undefined) {
      const value = Number(source[key]);
      if (!Number.isInteger(value) || value < min || value > max) {
        return NextResponse.json({ error: "invalid_" + key }, { status: 400 });
      }
      patch[key] = value;
    }
  }

  for (const key of ["require_mfa", "ip_restrictions", "require_strong_passwords", "allow_api_access"]) {
    if (source[key] !== undefined) {
      if (typeof source[key] !== "boolean") return NextResponse.json({ error: "invalid_" + key }, { status: 400 });
      patch[key] = source[key];
    }
  }

  const timezone = cleanText(source.default_timezone, 64);
  if (timezone !== undefined) patch.default_timezone = timezone || "UTC";

  const dateFormat = cleanText(source.date_format, 32);
  if (dateFormat !== undefined) patch.date_format = dateFormat || "YYYY-MM-DD";

  if (source.theme !== undefined) {
    if (!["dark", "system"].includes(source.theme)) return NextResponse.json({ error: "invalid_theme" }, { status: 400 });
    patch.theme = source.theme;
  }

  for (const key of ["ai_config", "agent_controls", "approval_policies", "notifications", "evidence_config"]) {
    if (source[key] !== undefined) {
      if (!source[key] || typeof source[key] !== "object" || Array.isArray(source[key])) {
        return NextResponse.json({ error: "invalid_" + key }, { status: 400 });
      }
      patch[key] = source[key];
    }
  }

  const { data, error } = await ctx.supabase
    .from("workspace_settings")
    .upsert(patch, { onConflict: "workspace_id" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "settings_update_failed" }, { status: 500 });

  return NextResponse.json({ settings: data });
}

export async function DELETE(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "owner_required" }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "invalid_delete_request" }, { status: 400 });
  }

  const { data: workspace } = await ctx.supabase
    .from("workspaces")
    .select("name")
    .eq("id", ctx.workspaceId)
    .eq("owner_id", ctx.userId)
    .maybeSingle();

  if (!workspace) return NextResponse.json({ error: "workspace_not_found" }, { status: 404 });
  if (body?.confirmation !== workspace.name) {
    return NextResponse.json({ error: "workspace_name_confirmation_required" }, { status: 400 });
  }

  const { error } = await ctx.supabase
    .from("workspaces")
    .delete()
    .eq("id", ctx.workspaceId)
    .eq("owner_id", ctx.userId);

  if (error) return NextResponse.json({ error: "workspace_delete_failed" }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
