import { createClient } from "./supabase/server";

export async function getWorkspaceContext() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return null;

  // RLS already limits membership visibility, but keep the ownership predicate
  // explicit here so workspace selection remains fail-closed if policies evolve.
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id,role")
    .eq("user_id", userId)
    .order("workspace_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
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
