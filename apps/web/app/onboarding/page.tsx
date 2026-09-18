import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { createWorkspace } from "./actions";

export default async function Onboarding() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/auth/github");
  const { data: memberships } = await supabase.from("workspace_members").select("workspace_id").limit(1);
  if (memberships?.length) redirect("/network");
  return (
    <main style={{maxWidth:560,margin:"12vh auto",padding:24}}>
      <p>NODRA / WORKSPACE</p>
      <h1>Create your security workspace</h1>
      <p>This workspace will contain your agents, policies, incidents, evidence and recovery state.</p>
      <form action={createWorkspace}>
        <label>Workspace name</label>
        <input name="name" required minLength={2} maxLength={120} placeholder="My Nodra Workspace" />
        <button type="submit">Create workspace</button>
      </form>
    </main>
  );
}
