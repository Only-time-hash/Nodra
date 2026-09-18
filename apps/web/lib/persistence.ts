import { createHash } from "node:crypto";
import { createClient } from "./supabase/server";

export async function getWorkspaceContext() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return null;
  const { data } = await supabase.from("workspace_members").select("workspace_id,role").limit(1).maybeSingle();
  return data ? { supabase, workspaceId: data.workspace_id as string, role: data.role as string, userId: claims.claims.sub as string } : null;
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

export function eventHash(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
