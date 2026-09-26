import { cookies } from "next/headers";
import { createClient } from "./supabase/server";

export async function getWorkspaceContext() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return null;

  const cookieStore = await cookies();
  const selectedWorkspaceId = cookieStore.get("nodra_workspace_id")?.value;
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const baseQuery = () =>
    supabase
      .from("workspace_members")
      .select("workspace_id,role")
      .eq("user_id", userId);

  let data: { workspace_id: string; role: string } | null = null;

  if (selectedWorkspaceId && uuidLike.test(selectedWorkspaceId)) {
    const selected = await baseQuery()
      .eq("workspace_id", selectedWorkspaceId)
      .maybeSingle();
    if (selected.error) return null;
    data = selected.data as typeof data;
  }

  if (!data) {
    const fallback = await baseQuery()
      .order("workspace_id", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (fallback.error) return null;
    data = fallback.data as typeof data;
  }

  if (!data) return null;
  return {
    supabase,
    workspaceId: data.workspace_id as string,
    role: data.role as string,
    userId,
  };
}

export async function ensureLabAgents() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return null;
  const defs = [
    ["manager","Manager"],["research","Research"],["finance","Finance"],["support","Support"],["data","Data"]
  ];
  const { data: existing } = await ctx.supabase.from("agents").select("id,external_id").eq("workspace_id",ctx.workspaceId);
  const found = new Map((existing ?? []).map((a:any)=>[a.external_id,a.id]));
  for (const [external_id,name] of defs) {
    if (!found.has(external_id)) {
      const { data } = await ctx.supabase.from("agents").insert({workspace_id:ctx.workspaceId,external_id,name,kind:"laboratory"}).select("id,external_id").single();
      if (data) found.set(data.external_id,data.id);
    }
  }
  return { ...ctx, agents: found };
}
