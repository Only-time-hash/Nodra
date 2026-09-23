import { GitHubAuthButton } from "../components/github-auth-button";
import { ShieldCheck, Eye, Network, Siren, FileCheck2, Code2, Building2, Users, CheckCircle2, LockKeyhole, Database, Workflow, Boxes, ArrowRight } from "lucide-react";

const features=[
  {n:"01",icon:ShieldCheck,title:"Enforce authority",body:"Put a deterministic boundary between agent intent and consequential action.",tag:"CONTROL"},
  {n:"02",icon:Eye,title:"See every action",body:"Turn protected runtime activity into high-signal, workspace-scoped evidence.",tag:"OBSERVE"},
  {n:"03",icon:Network,title:"Trace causality",body:"Follow relationships between agents, resources, incidents and the actions that connected them.",tag:"TRACE"},
  {n:"04",icon:Siren,title:"Contain impact",body:"Move from suspicious behavior to containment and controlled recovery without losing context.",tag:"RESPOND"},
  {n:"05",icon:FileCheck2,title:"Require approval",body:"Hold sensitive actions at the boundary and bind human decisions to the exact authorization event.",tag:"GOVERN"},
  {n:"06",icon:Boxes,title:"Integrate cleanly",body:"Protect existing agent runtimes through signed APIs and SDK-level enforcement points.",tag:"BUILD"}
];

export default function HomePage(){return <main className="refHome" id="top">
  <header className="refNav refShell">
    <a className="refBrand" href="#top" aria-label="Nodra home"><span className="refBrandGlyph" aria-hidden="true"><i/><i/></span><b>NODRA</b></a>
    <nav><a href="#product">Product</a><a href="#solutions">Solutions</a><a href="#developers">Developers</a><a href="#security">Security</a><a href="/docs">Resources</a></nav>
    <div className="refNavActions"><GitHubAuthButton className="refSign">Sign in</GitHubAuthButton><GitHubAuthButton className="refPrimary">Get Started <ArrowRight/></GitHubAuthButton></div>
  </header>

  <section className="refHero refShell">
    <div className="refHeroCopy">
      <span className="refEyebrow"><i/> THE CONTROL LAYER FOR AGENTIC AI</span>
      <h1>Give AI agents<br/><span>freedom to act.</span><br/><em>Keep control.</em></h1>
      <p>Nodra is the security control plane between autonomous agents and the systems they can change — identity, authority, policy, evidence and recovery in one trusted layer.</p>
      <div className="refHeroButtons"><GitHubAuthButton className="refPrimary big">Get Started for Free <ArrowRight/></GitHubAuthButton><a className="refOutline" href="/docs">View Documentation</a></div>
      <div className="refChecks"><span><i/> Identity-bound</span><span><i/> Policy-enforced</span><span><i/> Evidence-preserving</span></div><div className="heroSignal"><span>AGENT</span><i/><b>NODRA CONTROL PLANE</b><i/><span>TOOLS & SYSTEMS</span></div>
    </div>
    <div className="refRobot" aria-label="Nodra autonomous agent security">
      <div className="refPlanet"/>
      <div className="refBot" aria-hidden="true"><div className="botAntenna"/><div className="botHelmet"><span className="botTempleMark">N</span><span className="botFaceplate"/><i className="botEye"/><span className="botCheek"/><span className="botJaw"/></div><div className="botNeck"/><div className="botShoulder left"/><div className="botShoulder right"/><div className="botBody"><span className="botChestMark">N</span></div></div>
      <div className="refHeroStatement"><small>AUTONOMY WITHOUT BLIND TRUST</small>AI AGENTS<br/>DESERVE<br/><strong>REAL CONTROL</strong></div>
      <div className="refPills"><span>Identity</span><i/> <span>Authority</span><i/> <span>Control</span><i/> <span>Evidence</span></div>
      <div className="refMiniConsole"><div className="miniTop"><b><ShieldCheck/> NODRA</b><span><i/> LIVE CONTROL PLANE</span></div><div className="miniGrid"><div><small>IDENTITY</small><strong>Verified</strong></div><div><small>AUTHORITY</small><strong>Enforced</strong></div><div><small>EVIDENCE</small><strong>Preserved</strong></div></div><div className="miniGraph"><i/><i/><i/><i/><i/><i/></div></div>
    </div>
  </section>

  <section className="refTrust"><div className="refShell"><span>SECURITY CONTROL LAYERS</span><b>Identity</b><b>Authority</b><b>Policy</b><b>Evidence</b><b>Containment</b><b>Recovery</b><strong>BUILD A SAFER<br/>AI FUTURE</strong></div></section>

  <section className="refProduct refShell" id="product"><div className="refSectionIntro"><div><span className="refEyebrow"><i/> THE SECURITY CONTROL PLANE</span><h2>Autonomy needs<br/><em>boundaries that hold.</em></h2></div><p>Prompts can guide an agent. Nodra is designed to enforce what happens when that agent reaches for a real tool, API, database or system.</p></div><div className="refFeatures">{features.map(({n,icon:Icon,title,body,tag})=><article key={title}><div className="featureTop"><span className="featureIcon"><Icon/></span><small>{n}</small></div><span className="featureTag">{tag}</span><h3>{title}</h3><p>{body}</p><div className="featureLine"><i/><span/></div></article>)}</div><div className="refBoundary"><span>AGENT INTENT</span><i/><b><ShieldCheck/> NODRA ENFORCEMENT BOUNDARY</b><i/><span>CONSEQUENTIAL ACTION</span></div></section>

  <section className="refHow" id="security"><div className="refShell howInner"><div className="howCopy"><span className="refEyebrow"><i/> HOW NODRA WORKS</span><h2>One decision boundary.<br/><em>Every consequential action.</em></h2><p>An agent can reason freely. The moment it reaches for a protected resource, Nodra verifies the runtime identity, evaluates authority, records the decision and preserves the evidence.</p><div className="howSteps">
    <div><small>01</small><span><Users/></span><b>Agent intent</b><p>A protected agent requests a real action.</p></div><i/>
    <div><small>02</small><span><LockKeyhole/></span><b>Verify identity</b><p>Signed runtime credentials bind the request.</p></div><i/>
    <div><small>03</small><span><FileCheck2/></span><b>Enforce authority</b><p>Scope and policy determine the boundary.</p></div><i/>
    <div><small>04</small><span className="green"><CheckCircle2/></span><b>Decide</b><p>Allow, deny, or require human approval.</p></div><i/>
    <div><small>05</small><span><Database/></span><b>Preserve evidence</b><p>The outcome enters the security evidence chain.</p></div>
  </div></div><div className="riskVisual"><div className="riskGrid"/><div className="riskOrbit one"/><div className="riskOrbit two"/><div className="riskOrb"><ShieldCheck/><span>NODRA</span><small>ENFORCEMENT</small></div><div className="riskNode agent"><Users/><span>AGENT</span></div><div className="riskNode tool"><Workflow/><span>TOOL</span></div><div className="riskNode evidence"><Database/><span>EVIDENCE</span></div><div className="riskPulse"/><div className="riskCard"><small>CONTROL STATE</small><b><i/> ENFORCING</b><span>Identity verified · authority checked</span></div></div></div></section>

  <section className="refDevelopers refShell" id="developers">
    <div className="devCopy"><span className="refEyebrow"><i/> FOR DEVELOPERS</span><h2>Protect the action.<br/><em>Keep your stack.</em></h2><p>Nodra is designed to sit at the enforcement point in an existing agent runtime. Start with the repository SDK today or integrate directly with the signed REST boundary.</p><div className="devSignals"><span><ShieldCheck/> Signed requests</span><span><LockKeyhole/> Server-side credentials</span><span><FileCheck2/> Typed decisions</span></div><a className="devDocsLink" href="/docs">Open developer documentation <ArrowRight/></a></div>
    <div className="devWorkbench"><div className="workbenchTop"><div><i/><i/><i/></div><span>protect-agent.ts</span><small>QUICKSTART</small></div><div className="codeHead"><b>TypeScript</b><span>Python</span><span>REST</span><span>MCP</span></div><pre><code><span className="codeDim">{"// Bind Nodra to a runtime identity"}</span>{"\n"}<span className="codeBlue">const</span> agent = nodra.protect({"{"} id: <span className="codeGreen">"finance-agent"</span> {"}"});{"\n\n"}<span className="codeBlue">const</span> decision = <span className="codeBlue">await</span> agent.authorize({"{"}{"\n  "}resourceId: <span className="codeGreen">"payments"</span>,{"\n  "}action: <span className="codeGreen">"send_payment"</span>{"\n"}{"}"});{"\n\n"}<span className="codeBlue">if</span> (decision.decision !== <span className="codeGreen">"allow"</span>) stop();</code></pre><div className="workbenchResult"><span><i/> AUTHORIZATION</span><b>ALLOW</b><small>Evidence preserved</small></div><footer><span>Repository SDK available now</span><a href="/docs">Integration guide <ArrowRight/></a></footer></div>
    <div className="devArchitecture"><div className="devArchHead"><span>INTEGRATION SURFACE</span><b>One boundary. Multiple runtimes.</b></div><div className="devArchGrid"><span><Code2/><b>SDK</b><small>Application runtime</small></span><i/><span><Workflow/><b>Signed REST</b><small>Language agnostic</small></span><i/><span><Boxes/><b>MCP guard</b><small>Tool boundary</small></span></div><div className="devArchFoot"><ShieldCheck/><span>Nodra evaluates identity, authority and policy before the protected action crosses the boundary.</span></div></div>
  </section>

  <section className="refTeams refShell" id="solutions">
    <article><span className="refEyebrow">FOR SECURITY TEAMS</span><h2>Turn AI from a risk<br/>into a controlled advantage.</h2><div className="teamChecks"><span>✓ Policy enforcement</span><span>✓ Audit evidence</span><span>✓ Incident response</span><span>✓ Causal investigation</span></div><a className="refSmallButton" href="#security">Explore security features <ArrowRight/></a></article>
    <article><span className="refEyebrow">FOR ORGANIZATIONS</span><h2>Govern your AI agents<br/>at scale.</h2><div className="teamChecks"><span>✓ Workspace isolation</span><span>✓ Explicit authority</span><span>✓ Role-aware controls</span><span>✓ Controlled recovery</span></div><GitHubAuthButton className="refSmallButton">See workspace setup <ArrowRight/></GitHubAuthButton></article>
    <aside><ShieldCheck/><h3>Security from intent to recovery.</h3><p>One control plane for authorization, evidence, investigation, containment and verified restart.</p><a href="/docs">Read the security model →</a></aside>
  </section>

  <section className="refFinal"><div className="mountains"/><div className="refShell"><h2>A safer future for autonomous AI.</h2><p>Start securing your agents today.</p><div><GitHubAuthButton className="refPrimary">Get Started for Free <ArrowRight/></GitHubAuthButton><a className="refOutline" href="/docs">Read the Docs</a></div></div></section>

  <footer className="refFooter refShell"><div><a className="refBrand" href="#top" aria-label="Nodra home"><span className="refBrandGlyph" aria-hidden="true"><i/><i/></span><b>NODRA</b></a><small>© 2026 Nodra. All rights reserved.</small></div><div><b>Product</b><a href="#product">Overview</a><a href="#product">Features</a><a href="#security">Security</a></div><div><b>Developers</b><a href="/docs">Docs</a><a href="#developers">SDKs</a><a href="/docs">API Reference</a></div><div><b>Resources</b><a href="/docs">Documentation</a><a href="#security">Security model</a></div><div><b>Company</b><a href="#solutions">Who it is for</a><GitHubAuthButton className="footerButton">Get Started</GitHubAuthButton></div><div className="footerEnd"><b>Secure agents. Safer outcomes.</b><span>Security control infrastructure for autonomous AI.</span></div></footer>
</main>}