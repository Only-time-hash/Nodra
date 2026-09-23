import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { NodraMark } from "../../../components/nodra-mark";

export default async function WelcomeToNodra() {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/");

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .limit(1);

  if (!memberships?.length) redirect("/onboarding");

  const workspaceId = String(memberships[0].workspace_id);

  const { data: workspaceRecord } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();

  const workspace =
    typeof workspaceRecord?.name === "string"
      ? workspaceRecord.name
      : "";

  const metadata = (data.claims.user_metadata ?? {}) as Record<string, unknown>;

  const accountName =
    (typeof metadata.user_name === "string" && metadata.user_name) ||
    (typeof metadata.preferred_username === "string" && metadata.preferred_username) ||
    (typeof metadata.name === "string" && metadata.name) ||
    "GitHub user";

  const avatarUrl =
    typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : "";

  return (
    <main className="welcomePage">
      <div className="welcomeBackdrop" aria-hidden="true" />
      <header className="welcomeHeader">
        <Link className="welcomeBrand" href="/" aria-label="Nodra home">
          <span className="welcomeBrandMark"><NodraMark /></span>
          <b>NODRA</b>
        </Link>

        <div className="welcomeIdentity">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{accountName.slice(0, 1).toUpperCase()}</span>}
          <div>
            <b>{accountName}</b>
            <small>GitHub account connected</small>
          </div>
          <i aria-hidden="true" />
        </div>
      </header>

      <section className="welcomeShell">
        <div className="welcomeProgress" aria-label="Onboarding progress">
          <span className="done">✓</span>
          <i className="done" />
          <span className="active">◆</span>
          <i />
          <span>○</span>
          <div>Create Workspace</div>
          <div>Protect First Agent</div>
          <div>Enter Dashboard</div>
        </div>

        <div className="welcomeHero">
          <span className="welcomeTag">WELCOME TO NODRA</span>
          <h1>Your workspace is ready.</h1>
          <p>
            {workspace ? <><strong>{workspace}</strong> is created. </> : null}
            Now protect your first AI agent by defining exactly what it is allowed to do,
            generating a scoped credential, connecting its runtime, and verifying the first protected action.
          </p>
        </div>

        <div className="welcomeCard">
          <div className="welcomeCardIcon" aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <path d="M24 5 39 13.5v17L24 39 9 30.5v-17L24 5Z" />
              <path d="M9 13.5 24 22l15-8.5M24 22v17" />
              <path d="m18 25 4 4 8-9" />
            </svg>
          </div>

          <div className="welcomeCardCopy">
            <span>NEXT STEP</span>
            <h2>Protect your first agent</h2>
            <p>
              Nodra will guide you through registration, authority, credentials,
              integration, testing, and your first protected action.
            </p>
          </div>

          <div className="welcomeChecklist">
            <span><b>✓</b> Register Agent</span>
            <span><b>✓</b> Define Authority</span>
            <span><b>✓</b> Generate Credential</span>
            <span><b>✓</b> Choose JS / Python / REST / MCP</span>
            <span><b>✓</b> Integrate Nodra</span>
            <span><b>✓</b> Test Connection</span>
            <span><b>✓</b> Send First Protected Action</span>
          </div>

          <Link className="welcomePrimary" href="/onboarding/overview">
            Protect First Agent <span aria-hidden="true">→</span>
          </Link>

          <Link className="welcomeSecondary" href="/network">
            I’ll do this later
          </Link>
        </div>

        <div className="welcomeAssurance">
          <span>Identity</span><i />
          <span>Authority</span><i />
          <span>Evidence</span><i />
          <span>Containment</span><i />
          <span>Recovery</span>
        </div>
      </section>
    </main>
  );
}
