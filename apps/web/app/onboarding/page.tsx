import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, ShieldCheck, Users, FileCheck2 } from "lucide-react";
import { createClient } from "../../lib/supabase/server";
import { createWorkspace } from "./actions";
import { NodraMark } from "../../components/nodra-mark";
import "./flow.css";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) redirect("/auth?intent=signin");

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .limit(1);

  if (memberships?.length) redirect("/onboarding/welcome");

  const metadata = (data.claims.user_metadata ?? {}) as Record<string, unknown>;
  const accountName =
    (typeof metadata.name === "string" && metadata.name) ||
    (typeof metadata.user_name === "string" && metadata.user_name) ||
    (typeof data.claims.email === "string" && data.claims.email) ||
    "GitHub account";

  return (
    <main className="flowPage">
      <header className="flowHeader">
        <Link href="/" className="flowBrand" aria-label="Nodra home">
          <span className="flowBrandMark"><NodraMark /></span>
          <b>NODRA</b>
        </Link>
        <div className="workspaceIdentity">
          <span>{accountName.slice(0,1).toUpperCase()}</span>
          <div><b>{accountName}</b><small>GitHub connected</small></div>
          <i />
        </div>
      </header>

      <section className="flowShell workspaceShell">
        <div className="flowProgress3" aria-label="Onboarding progress">
          <div className="active"><span>◆</span><b>Create Workspace</b></div>
          <div><span>○</span><b>Welcome to Nodra</b></div>
          <div><span>○</span><b>Protect First Agent</b></div>
        </div>

        <div className="flowIntro">
          <span className="flowKicker">WORKSPACE SETUP</span>
          <h1>Create Your Workspace</h1>
          <p>A workspace keeps your agents, security data and team organized.</p>
        </div>

        <form action={createWorkspace} className="workspaceFlowCard">
          <div className="workspaceFlowIcon"><NodraMark /></div>

          <div className="workspaceFlowField">
            <label htmlFor="workspace-name">Workspace Name</label>
            <input
              id="workspace-name"
              name="name"
              required
              minLength={2}
              maxLength={120}
              placeholder="Acme Corporation"
              autoComplete="organization"
            />
            <small>Nodra automatically creates a unique workspace identifier from this name.</small>
          </div>

          <button className="workspaceCreateButton" type="submit">
            Create Workspace <span aria-hidden="true">→</span>
          </button>

          <div className="workspaceBenefits">
            <span><ShieldCheck /><b>Secure by design</b><small>Scoped access from day one</small></span>
            <span><Users /><b>Multi-agent ready</b><small>Coordinate agents safely</small></span>
            <span><FileCheck2 /><b>Audit & recovery</b><small>Evidence for every protected action</small></span>
          </div>

          <div className="workspaceNote"><Check /> You can create additional workspaces later.</div>
        </form>
      </section>
    </main>
  );
}
