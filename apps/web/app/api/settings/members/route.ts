import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

const allowedRoles = new Set(["admin", "analyst", "viewer"]);

export async function PATCH(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "owner_required" }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "invalid_member_update" }, { status: 400 });
  }

  if (typeof body?.userId !== "string" || !allowedRoles.has(body?.role)) {
    return NextResponse.json({ error: "invalid_member_update" }, { status: 400 });
  }

  if (body.userId === ctx.userId) {
    return NextResponse.json({ error: "owner_role_cannot_be_changed" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("workspace_members")
    .update({ role: body.role })
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", body.userId)
    .neq("role", "owner")
    .select("user_id,role")
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "member_update_failed" }, { status: error ? 500 : 404 });
  return NextResponse.json({ member: data });
}

export async function DELETE(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });
  if (ctx.role !== "owner") return NextResponse.json({ error: "owner_required" }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "invalid_member_remove" }, { status: 400 });
  }

  if (typeof body?.userId !== "string" || body.userId === ctx.userId) {
    return NextResponse.json({ error: "invalid_member_remove" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", body.userId)
    .neq("role", "owner")
    .select("user_id")
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "member_remove_failed" }, { status: error ? 500 : 404 });
  return NextResponse.json({ removed: true });
}
