import { GitHubAuthButton } from "../components/github-auth-button";
import { ArrowRight, ShieldCheck, Search, Database, Github } from "lucide-react";
import "./home-realistic.css";

export default function HomePage(){return <main className="nhHome" id="top">
<header className="nhNav nhShell">
  <a className="nhBrand" href="#top" aria-label="Nodra home"><img src="/nodra-logo.webp" alt="" /><b>Nodra</b></a>
  <nav aria-label="Primary navigation"><a href="#product">Product <span>⌄</span></a><a href="#solutions">Solutions <span>⌄</span></a><a href="#developers">Developers</a><a href="/docs">Resources <span>⌄</span></a></nav>
  <div className="nhActions"><a className="nhGithub" href="https://github.com/Only-time-hash/Nodra" aria-label="Nodra on GitHub"><Github/></a><GitHubAuthButton className="nhSign">Sign in</GitHubAuthButton><GitHubAuthButton className="nhPrimary">Get started <ArrowRight/></GitHubAuthButton></div>
</header>
<section className="nhHero nhShell">
  <div className="nhHeroCopy">
    <span className="nhEyebrow">THE AI AGENT SECURITY PLATFORM</span>
    <h1>Secure what your<br/>AI agents can<br/><em>actually do.</em></h1>
    <p>Nodra helps you control, monitor and protect AI agents across your tools, data and infrastructure — so they can be useful, without being risky.</p>
    <div className="nhCtas"><GitHubAuthButton className="nhPrimary nhLarge">Get started <ArrowRight/></GitHubAuthButton><a className="nhOutline" href="/docs">Read the docs</a></div>
    <div className="nhSignals"><span><ShieldCheck/><b>Control</b><small>authority and access</small></span><span><Search/><b>Detect</b><small>and stop risky actions</small></span><span><Database/><b>Investigate</b><small>and recover quickly</small></span></div>
  </div>
  <div className="nhVisual"><img className="nhReferenceArt" src="/nodra-hero-reference.webp" alt="AI Agent requests passing through Nodra identity, authority, policy and evidence controls to allowed, approval or blocked outcomes" /></div>
</section>
</main>}