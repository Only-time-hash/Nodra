"use server";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

export async function createWorkspace(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 120) throw new Error("Invalid workspace name");
  const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48) || "workspace";
  const slug = `${slugBase}-${crypto.randomUUID().slice(0,8)}`;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/auth/github");
  const { error } = await supabase.rpc("create_workspace",{p_name:name,p_slug:slug});
  if (error) throw new Error("Could not create workspace");
  redirect("/onboarding/integrate");
}
