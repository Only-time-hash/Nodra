import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Eye, Shield } from "lucide-react";
import { createClient } from "../../../lib/supabase/server";
import { NodraMark } from "../../../components/nodra-mark";
import "../flow.css";

export default async function WelcomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) redirect("/auth?intent=signin");

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .limit(1);

  if (!memberships?.length) redirect("/onboarding");

  const metadata = (data.claims.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    (typeof metadata.name === "string" && metadata.name) ||
    (typeof metadata.user_name === "string" && metadata.user_name) ||
    (typeof data.claims.email === "string" && data.claims.email) ||
    "there";

  const firstName = displayName.split(/[ ,@]/)[0] || "there";

  return (
    <main className="flowPage">
      <header className="flowHeader">
        <Link href="/" className="flowBrand" aria-label="Nodra home">
          <span className="flowBrandMark"><NodraMark /></span>
          <b>NODRA</b>
        </Link>
        <Link href="/docs" className="flowHelp">ⓘ Help</Link>
      </header>

      <section className="flowShell">
        <div className="flowProgress3" aria-label="Onboarding progress">
          <div><span>✓</span><b>Create Workspace</b></div>
          <div className="active"><span>◆</span><b>Welcome to Nodra</b></div>
          <div><span>○</span><b>Protect First Agent</b></div>
        </div>

        <div className="welcomePanel">
          <div className="flowIntro">
            <span className="flowKicker">WELCOME TO NODRA</span>
            <h1>Welcome to Nodra, {firstName}!</h1>
            <p>You&apos;re one step away from securing your AI agents.</p>
          </div>

          <div className="welcomeStats">
            <article>
              <Shield />
              <b>Prevent</b>
              <small>unauthorized actions</small>
            </article>
            <article>
              <Eye />
              <b>See everything</b>
              <small>your agents do</small>
            </article>
            <article>
              <BarChart3 />
              <b>Respond and recover</b>
              <small>when something goes wrong</small>
            </article>
          </div>

          <div className="flowActions">
            <Link className="flowPrimary" href="/onboarding/overview?entry=welcome">
              Protect Your First Agent <span aria-hidden="true">→</span>
            </Link>
            <Link className="flowSecondary" href="/network">
              Skip for now
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
