import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bot,
  Code2,
  FileCheck2,
  KeyRound,
  Network,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { createClient } from "../../../lib/supabase/server";
import { NodraMark } from "../../../components/nodra-mark";
import "../flow.css";

const steps = [
  { icon: Bot, title: "Register Agent", text: "Give your agent a name and description." },
  { icon: ShieldCheck, title: "Define Authority", text: "Set what it can and cannot do." },
  { icon: KeyRound, title: "Generate Credential", text: "Create a secure server-side key." },
  { icon: Code2, title: "Choose Integration", text: "Pick JavaScript, Python, REST, or MCP." },
  { icon: Terminal, title: "Integrate Nodra", text: "Add Nodra to your agent runtime." },
  { icon: Network, title: "Test Connection", text: "Verify the real runtime is connected." },
  { icon: FileCheck2, title: "Send First Protected Action", text: "Verify Nodra receives real protected evidence." },
];

export default async function OverviewPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) redirect("/auth?intent=signin");

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .limit(1);

  if (!memberships?.length) redirect("/onboarding");

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
        <div className="flowIntro">
          <span className="flowKicker">ONBOARDING OVERVIEW</span>
          <h1>Let&apos;s protect your first agent.</h1>
          <p>It only takes a few minutes. Follow the steps below and Nodra will verify each protection layer as you go.</p>
        </div>

        <div className="overviewGrid">
          <div className="overviewList">
            {steps.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span className="overviewIcon"><Icon /></span>
                <div>
                  <b>{title}</b>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>

          <aside className="overviewSide">
            <div className="overviewOrb"><ShieldCheck /></div>
            <b>By the end, your agent will be protected.</b>
            <p>Estimated time: 5–10 minutes</p>
            <div className="overviewMeta">
              <span>Identity</span>
              <span>Authority</span>
              <span>Credential</span>
              <span>Runtime evidence</span>
            </div>
          </aside>
        </div>

        <div className="flowActions" style={{ marginTop: 22, justifyContent: "flex-end" }}>
          <Link className="flowSecondary" href="/network">Skip for now</Link>
          <Link className="flowPrimary" href="/onboarding/protect">
            Get Started <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
