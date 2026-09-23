import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  Code2,
  FileCheck2,
  KeyRound,
  PlayCircle,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { createClient } from "../../../lib/supabase/server";
import { NodraMark } from "../../../components/nodra-mark";

const onboardingSteps = [
  { icon: Bot, title: "Register Agent", text: "Give your agent a name and identity." },
  { icon: ShieldCheck, title: "Define Authority", text: "Set exactly what the agent may access and do." },
  { icon: KeyRound, title: "Generate Credential", text: "Create a scoped server-side integration key." },
  { icon: Code2, title: "Choose Integration", text: "Use JavaScript, Python, REST API, or MCP." },
  { icon: SlidersHorizontal, title: "Integrate Nodra", text: "Add Nodra to the agent runtime and wrap protected actions." },
  { icon: PlayCircle, title: "Test Connection", text: "Verify credential use, authority, and runtime evidence." },
  { icon: FileCheck2, title: "Send First Protected Action", text: "Confirm the real agent produces a Nodra decision and evidence." },
];

export default async function OnboardingOverviewPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) redirect("/auth?intent=signin");

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .limit(1);

  if (!memberships?.length) redirect("/onboarding");

  return (
    <main className="overviewPage">
      <header className="overviewHeader">
        <Link className="overviewBrand" href="/" aria-label="Nodra home">
          <span><NodraMark /></span>
          <b>NODRA</b>
        </Link>
        <Link className="overviewHelp" href="/docs">ⓘ Help</Link>
      </header>

      <section className="overviewShell">
        <div className="overviewIntro">
          <span className="overviewKicker">ONBOARDING</span>
          <h1>Let&apos;s protect your first agent.</h1>
          <p>It only takes a few minutes. Follow the steps below and Nodra will verify each security layer as you go.</p>
        </div>

        <div className="overviewGrid">
          <div className="overviewSteps">
            {onboardingSteps.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span className="overviewStepIcon"><Icon /></span>
                <div>
                  <b>{title}</b>
                  <p>{text}</p>
                </div>
                <CheckCircle2 className="overviewCheck" aria-hidden="true" />
              </article>
            ))}
          </div>

          <aside className="overviewShield">
            <div className="overviewShieldOrb">
              <ShieldCheck />
            </div>
            <b>Protection path</b>
            <p>Identity → Authority → Credential → Runtime → Evidence</p>
            <div className="overviewProof">
              <span>Scoped authority</span>
              <span>Server-side credential</span>
              <span>Verifiable runtime evidence</span>
            </div>
          </aside>
        </div>

        <div className="overviewActions">
          <Link className="overviewSecondary" href="/network">I&apos;ll do this later</Link>
          <Link className="overviewPrimary" href="/onboarding/protect">
            Get started <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
