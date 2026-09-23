import { GitHubAuthButton } from "../components/github-auth-button";
import { ArrowRight, ShieldCheck, Search, Database } from "lucide-react";
import "./home-realistic.css";

export default function HomePage(){return <main className="nhHome" id="top">
<header className="nhNav nhShell">
  <a className="nhBrand" href="#top" aria-label="Nodra home"><span className="nhLogo" aria-hidden="true"><i/><i/><i/></span><b>Nodra</b></a>
  <nav aria-label="Primary navigation"><a href="#product">Product <span>⌄</span></a><a href="#solutions">Solutions <span>⌄</span></a><a href="#developers">Developers</a><a href="/docs">Resources <span>⌄</span></a></nav>
  <div className="nhActions"><a className="nhGithub" href="https://github.com/Only-time-hash/Nodra" aria-label="Nodra on GitHub">◉</a><GitHubAuthButton className="nhSign">Sign in</GitHubAuthButton><GitHubAuthButton className="nhPrimary">Get started <ArrowRight/></GitHubAuthButton></div>
</header>

<section className="nhHero nhShell">
  <div className="nhHeroCopy">
    <span className="nhEyebrow">THE AI AGENT SECURITY PLATFORM</span>
    <h1>Secure what your<br/>AI agents can<br/><em>actually do.</em></h1>
    <p>Nodra puts an enforceable security boundary between autonomous agents and the tools, data and systems they can change.</p>
    <div className="nhCtas"><GitHubAuthButton className="nhPrimary nhLarge">Get started <ArrowRight/></GitHubAuthButton><a className="nhOutline" href="/docs">Read the docs</a></div>
    <div className="nhSignals"><span><ShieldCheck/><b>Control</b><small>authority and access</small></span><span><Search/><b>Investigate</b><small>preserve security evidence</small></span><span><Database/><b>Recover</b><small>contain and restore safely</small></span></div>
  </div>

  <div className="nhVisual" aria-label="Nodra enforcement boundary">
    <div className="nhMesh"/>
    <div className="nhAgentCard"><strong>AI Agent</strong><span>Intent</span><span>Tool request</span><span>Action</span></div>
    <div className="nhStack">
      <div><i>◇</i><span><b>Identity</b><small>Who is acting?</small></span></div>
      <div><i>✓</i><span><b>Authority</b><small>What can it do?</small></span></div>
      <div><i>⬡</i><span><b>Policy Enforcement</b><small>Is it allowed?</small></span></div>
      <div><i>□</i><span><b>Evidence</b><small>What happened?</small></span></div>
      <strong className="nhStackBrand"><span className="nhLogo"><i/><i/><i/></span>Nodra <small>SECURITY BOUNDARY</small></strong>
    </div>
    <div className="nhOutcome allow"><i>✓</i><span><b>Allowed</b><small>Action proceeds</small></span></div>
    <div className="nhOutcome approval"><i>!</i><span><b>Requires Approval</b><small>Human review required</small></span></div>
    <div className="nhOutcome blocked"><i>×</i><span><b>Blocked</b><small>Action stopped</small></span></div>
  </div>
</section>
</main>}