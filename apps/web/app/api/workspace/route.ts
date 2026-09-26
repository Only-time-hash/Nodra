import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id,role,workspaces(id,name,slug)")
    .eq("user_id", userId)
    .order("workspace_id", { ascending: true });

  if (error) return NextResponse.json({ error: "workspace_lookup_failed" }, { status: 500 });

  const memberships = data ?? [];
  const cookieHeader = request.headers.get("cookie") ?? "";
  const selectedMatch = cookieHeader.match(/(?:^|;\s*)nodra_workspace_id=([^;]+)/);
  const selectedWorkspaceId = selectedMatch ? decodeURIComponent(selectedMatch[1]) : null;
  const active =
    memberships.find((membership: any) => membership.workspace_id === selectedWorkspaceId) ??
    memberships[0] ??
    null;

  return NextResponse.json({
    workspace: active,
    workspaces: memberships,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : "";
  if (!uuidLike.test(workspaceId)) {
    return NextResponse.json({ error: "invalid_workspace_id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id,role,workspaces(id,name,slug)")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "workspace_lookup_failed" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "workspace_access_denied" }, { status: 403 });

  const response = NextResponse.json({ workspace: data });
  response.cookies.set("nodra_workspace_id", workspaceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
