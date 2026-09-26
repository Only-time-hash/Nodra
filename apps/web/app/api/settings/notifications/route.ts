import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });

  const { data, error } = await ctx.supabase
    .from("notification_destinations")
    .select("id,kind,label,enabled,event_types,created_at,updated_at")
    .eq("workspace_id", ctx.workspaceId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "notification_destinations_query_failed" }, { status: 500 });
  return NextResponse.json({ destinations: data ?? [] });
}

export async function POST(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });
  if (!["owner", "admin"].includes(ctx.role)) return NextResponse.json({ error: "insufficient_role" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.kind !== "string" || typeof body.label !== "string" || typeof body.endpointUrl !== "string") {
    return NextResponse.json({ error: "invalid_notification_destination" }, { status: 400 });
  }

  const eventTypes = Array.isArray(body.eventTypes)
    ? body.eventTypes.filter((x: unknown) => ["incident", "denial", "recovery"].includes(String(x)))
    : ["incident", "denial", "recovery"];

  const { data, error } = await ctx.supabase.rpc("set_notification_destination", {
    p_kind: body.kind,
    p_label: body.label,
    p_endpoint_url: body.endpointUrl,
    p_event_types: eventTypes,
  } as any);

  if (error) {
    const message = String(error.message ?? "");
    if (message.includes("https_endpoint_required")) return NextResponse.json({ error: "https_endpoint_required" }, { status: 400 });
    if (message.includes("insufficient_role")) return NextResponse.json({ error: "insufficient_role" }, { status: 403 });
    return NextResponse.json({ error: "notification_destination_save_failed" }, { status: 500 });
  }

  return NextResponse.json({ destination: Array.isArray(data) ? data[0] : data });
}

export async function DELETE(request: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "authentication_or_workspace_required" }, { status: 401 });
  if (!["owner", "admin"].includes(ctx.role)) return NextResponse.json({ error: "insufficient_role" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "id_required" }, { status: 400 });

  const { data, error } = await ctx.supabase.rpc("delete_notification_destination", { p_id: body.id } as any);
  if (error) return NextResponse.json({ error: "notification_destination_delete_failed" }, { status: 500 });

  return NextResponse.json({ removed: data === true });
}
