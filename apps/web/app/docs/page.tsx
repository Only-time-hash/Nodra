import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Code2,
  KeyRound,
  Network,
  ShieldCheck,
} from "lucide-react";
import { WorkspaceSidebar } from "../components/workspace-sidebar";

const sections = [
  {
    title: "JavaScript / TypeScript",
    text: "Use the Nodra SDK workspace to authorize consequential agent actions before execution.",
    href: "/integrations/javascript",
    icon: Code2,
  },
  {
    title: "Python",
    text: "Sign requests server-side and call the protected authorization gateway from Python runtimes.",
    href: "/integrations/python",
    icon: Code2,
  },
  {
    title: "REST API",
    text: "Integrate any backend capable of SHA-256 and HMAC-SHA256 without depending on a language-specific SDK.",
    href: "/integrations/rest",
    icon: Network,
  },
  {
    title: "MCP Guard",
    text: "Protect consequential MCP tool calls at the execution boundary instead of relying only on prompt inspection.",
    href: "/integrations/mcp",
    icon: ShieldCheck,
  },
  {
    title: "Credentials",
    text: "Issue, rotate and revoke server-side runtime identities without exposing plaintext secrets in the browser.",
    href: "/credentials",
    icon: KeyRound,
  },
];

export default function DocsPage() {
  return (
    <main className="lab">
      <WorkspaceSidebar active="Integrations" />
      <section className="labMain">
        <div className="commandTopbar">
          <div className="commandSearch integrationBreadcrumb">
            <span>NODRA / DOCUMENTATION</span>
          </div>
          <div className="topbarStatus">
            <span className="liveIndicator live"><i /> DOCS</span>
            <span>V0.1</span>
          </div>
        </div>

        <div className="consoleDocs">
          <header className="consoleDocsHero">
            <span>NODRA DOCUMENTATION</span>
            <h1>Secure agent actions with explicit boundaries.</h1>
            <p>
              Developer guidance for connecting real autonomous agents to Nodra’s
              authority, evidence, containment and recovery control plane.
            </p>
          </header>

          <section className="refMainPanel docsQuickstart">
            <div className="refPanelTitle">
              <div>
                <h3>Quickstart</h3>
                <small>From unprotected agent to verified protected runtime.</small>
              </div>
              <BookOpen />
            </div>
            <div className="docsSteps">
              {[
                "Create or select a Nodra workspace.",
                "Register the agent that will request authorization.",
                "Define the agent’s explicit authority scope.",
                "Issue and store the integration credential server-side.",
                "Route consequential actions through Nodra before execution.",
                "Verify the signed runtime evidence in Security Events.",
              ].map((step, index) => (
                <article key={step}>
                  <span>{index + 1}</span>
                  <b>{step}</b>
                </article>
              ))}
            </div>
          </section>

          <div className="consoleDocsGrid">
            {sections.map(({ title, text, href, icon: Icon }) => (
              <Link key={title} href={href}>
                <span><Icon /></span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
                <ArrowRight />
              </Link>
            ))}
          </div>

          <section className="docsSecurityBoundary">
            <ShieldCheck />
            <div>
              <b>Security model</b>
              <p>
                Nodra authenticates protected requests, evaluates authority,
                records ordered evidence and keeps secrets outside browser code.
              </p>
            </div>
            <Link href="/activity">Open Security Events</Link>
          </section>
        </div>
      </section>
    </main>
  );
}
