import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../lib/persistence";

const effects = new Set(["allow", "deny", "require_approval"]);
const roles = new Set(["owner", "admin"]);
const allowedConstraintKeys = new Set([
  "amountGreaterThan",
  "amountGreaterThanOrEqual",
  "amountLessThan",
  "amountLessThanOrEqual",
  "environmentIn",
  "dayOfWeekIn",
  "hourUtcFrom",
  "hourUtcUntil",
  "metadataEquals",
]);

function validText(value: unknown, max = 128) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max
    ? value.trim()
    : null;
}

function validDate(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

function validateConstraints(value: unknown) {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const input = value as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!allowedConstraintKeys.has(key)) return null;
  }

  const numericKeys = [
    "amountGreaterThan",
    "amountGreaterThanOrEqual",
    "amountLessThan",
    "amountLessThanOrEqual",
  ];
  for (const key of numericKeys) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== "number" || !Number.isFinite(input[key])) return null;
    }
  }

  if (input.environmentIn !== undefined) {
    if (
      !Array.isArray(input.environmentIn) ||
      input.environmentIn.length > 20 ||
      input.environmentIn.some(
        (item) => typeof item !== "string" || !item.trim() || item.length > 64,
      )
    ) return null;
  }

  if (input.dayOfWeekIn !== undefined) {
    if (
      !Array.isArray(input.dayOfWeekIn) ||
      input.dayOfWeekIn.length > 7 ||
      input.dayOfWeekIn.some(
        (item) => !Number.isInteger(item) || Number(item) < 0 || Number(item) > 6,
      )
    ) return null;
  }

  for (const key of ["hourUtcFrom", "hourUtcUntil"]) {
    if (input[key] !== undefined) {
      if (!Number.isInteger(input[key]) || Number(input[key]) < 0 || Number(input[key]) > 24) {
        return null;
      }
    }
  }

  if (input.metadataEquals !== undefined) {
    if (
      !input.metadataEquals ||
      typeof input.metadataEquals !== "object" ||
      Array.isArray(input.metadataEquals)
    ) return null;

    const entries = Object.entries(input.metadataEquals as Record<string, unknown>);
    if (entries.length > 20) return null;

    for (const [key, item] of entries) {
      if (!key || key.length > 64) return null;
      if (!["string", "number", "boolean"].includes(typeof item)) return null;
      if (typeof item === "number" && !Number.isFinite(item)) return null;
      if (typeof item === "string" && item.length > 256) return null;
    }
  }

  return input;
}

async function assertAgent(
  ctx: Awaited<ReturnType<typeof getWorkspaceContext>>,
  agentId: string | null,
) {
  if (!ctx || !agentId) return true;
  const { data } = await ctx.supabase
    .from("agents")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", agentId)
    .maybeSingle();
  return Boolean(data);
}

async function assertResource(
  ctx: Awaited<ReturnType<typeof getWorkspaceContext>>,
  resourceId: string | null,
) {
  if (!ctx || !resourceId) return true;
  const { data } = await ctx.supabase
    .from("resources")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", resourceId)
    .maybeSingle();
  return Boolean(data);
}

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const { data, error } = await ctx.supabase
    .from("policies")
    .select(
      "id,action,effect,enabled,constraints,priority,starts_at,expires_at,created_at,agent_id,resource_id,agents(name,external_id),resources(name,external_id)",
    )
    .eq("workspace_id", ctx.workspaceId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "policy_query_failed" }, { status: 500 });
  return NextResponse.json({ policies: data ?? [], canManage: roles.has(ctx.role) });
}

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  if (!roles.has(ctx.role)) {
    return NextResponse.json({ error: "owner_or_admin_required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const action = validText(body?.action);
  const effect = body?.effect;

  if (!action || !effects.has(effect)) {
    return NextResponse.json({ error: "valid_action_and_effect_required" }, { status: 400 });
  }

  if (action.includes("*") && !action.endsWith("*")) {
    return NextResponse.json({ error: "wildcard_must_be_trailing" }, { status: 400 });
  }

  const agentId =
    typeof body?.agentId === "string" && body.agentId.trim() ? body.agentId.trim() : null;
  const resourceId =
    typeof body?.resourceId === "string" && body.resourceId.trim() ? body.resourceId.trim() : null;

  if (!(await assertAgent(ctx, agentId))) {
    return NextResponse.json({ error: "agent_outside_workspace" }, { status: 400 });
  }
  if (!(await assertResource(ctx, resourceId))) {
    return NextResponse.json({ error: "resource_outside_workspace" }, { status: 400 });
  }

  const constraints = validateConstraints(body?.constraints);
  if (constraints === null) {
    return NextResponse.json({ error: "invalid_policy_constraints" }, { status: 400 });
  }

  const priority = body?.priority === undefined ? 100 : Number(body.priority);
  if (!Number.isInteger(priority) || priority < 0 || priority > 10_000) {
    return NextResponse.json({ error: "invalid_policy_priority" }, { status: 400 });
  }

  const startsAt = validDate(body?.startsAt);
  const expiresAt = validDate(body?.expiresAt);
  if (startsAt === undefined || expiresAt === undefined) {
    return NextResponse.json({ error: "invalid_policy_time_window" }, { status: 400 });
  }
  if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
    return NextResponse.json({ error: "policy_expiry_must_follow_start" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("policies")
    .insert({
      workspace_id: ctx.workspaceId,
      action,
      effect,
      agent_id: agentId,
      resource_id: resourceId,
      constraints,
      priority,
      starts_at: startsAt,
      expires_at: expiresAt,
      enabled: true,
    } as any)
    .select(
      "id,action,effect,enabled,constraints,priority,starts_at,expires_at,created_at,agent_id,resource_id",
    )
    .single();

  if (error) return NextResponse.json({ error: "policy_create_failed" }, { status: 500 });
  return NextResponse.json({ policy: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  if (!roles.has(ctx.role)) {
    return NextResponse.json({ error: "owner_or_admin_required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = validText(body?.id, 64);
  if (!id) return NextResponse.json({ error: "policy_id_required" }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "invalid_policy_enabled" }, { status: 400 });
    }
    patch.enabled = body.enabled;
  }

  if (body.effect !== undefined) {
    if (!effects.has(body.effect)) {
      return NextResponse.json({ error: "invalid_policy_effect" }, { status: 400 });
    }
    patch.effect = body.effect;
  }

  if (body.priority !== undefined) {
    const priority = Number(body.priority);
    if (!Number.isInteger(priority) || priority < 0 || priority > 10_000) {
      return NextResponse.json({ error: "invalid_policy_priority" }, { status: 400 });
    }
    patch.priority = priority;
  }

  if (body.constraints !== undefined) {
    const constraints = validateConstraints(body.constraints);
    if (constraints === null) {
      return NextResponse.json({ error: "invalid_policy_constraints" }, { status: 400 });
    }
    patch.constraints = constraints;
  }

  if (body.startsAt !== undefined) {
    const startsAt = validDate(body.startsAt);
    if (startsAt === undefined) {
      return NextResponse.json({ error: "invalid_policy_time_window" }, { status: 400 });
    }
    patch.starts_at = startsAt;
  }

  if (body.expiresAt !== undefined) {
    const expiresAt = validDate(body.expiresAt);
    if (expiresAt === undefined) {
      return NextResponse.json({ error: "invalid_policy_time_window" }, { status: 400 });
    }
    patch.expires_at = expiresAt;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "no_policy_changes" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("policies")
    .update(patch as any)
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", id)
    .select(
      "id,action,effect,enabled,constraints,priority,starts_at,expires_at,created_at,agent_id,resource_id",
    )
    .maybeSingle();

  if (error) return NextResponse.json({ error: "policy_update_failed" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "policy_not_found" }, { status: 404 });

  return NextResponse.json({ policy: data });
}

export async function DELETE(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  if (!roles.has(ctx.role)) {
    return NextResponse.json({ error: "owner_or_admin_required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = validText(body?.id, 64);
  if (!id) return NextResponse.json({ error: "policy_id_required" }, { status: 400 });

  const { data, error } = await ctx.supabase
    .from("policies")
    .delete()
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "policy_delete_failed" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "policy_not_found" }, { status: 404 });

  return NextResponse.json({ deleted: true });
}
