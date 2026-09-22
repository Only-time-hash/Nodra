import { GitHubAuthButton } from "../components/github-auth-button";
import { ShieldCheck, Eye, Network, Siren, RotateCcw, Code2, Building2, Users, FileCheck2, CheckCircle2, Ban, Activity, Fingerprint, LockKeyhole, Search, CircleDollarSign, Database, Headphones } from "lucide-react";

const features=[
{icon:ShieldCheck,title:"Prevent",body:"Stop unauthorized actions before they happen."},
{icon:Eye,title:"Observe",body:"See consequential agent actions and security events."},
{icon:Network,title:"Understand",body:"Trace authority, provenance, and agent-to-agent paths."},
{icon:Siren,title:"Respond",body:"Investigate incidents and contain affected agents."},
{icon:FileCheck2,title:"Govern",body:"Apply explicit policies and preserve reviewable evidence."},
{icon:RotateCcw,title:"Recover",body:"Verify recovery state before controlled restart."}
];

export default function HomePage(){return <main className="productHome" id="top">
<header className="productNav shell"><a className="productBrand" href="#top"><img src="/nodra-logo.webp" alt="Nodra"/><strong>NODRA</strong></a><nav><a href="#product">Product</a><a href="#solutions">Solutions</a><a href="#developers">Developers</a><a href="#security">Security</a><a href="/docs">Docs</a></nav><div className="productNavActions"><GitHubAuthButton className="productSign">Sign in</GitHubAuthButton><GitHubAuthButton className="productPrimary small">Get Started →</GitHubAuthButton></div></header>
<section className="productHero shell"><div className="productHeroCopy"><span className="productEyebrow">SECURITY FOR AUTONOMOUS AI AGENTS</span><h1>Control the agents<br/>that move your world.</h1><p>Nodra gives AI agents identity and explicit authority, evaluates consequential actions before execution, preserves evidence, and gives security teams tools to investigate, contain, and recover.</p><div className="productHeroActions"><GitHubAuthButton className="productPrimary">Get Started for Free →</GitHubAuthButton><a className="productSecondary" href="/docs">View Docs</a></div><div className="productProof"><span>✓ Security by design</span><span>✓ Works with existing agents</span><span>✓ Built for real-world use</span></div></div>
<div className="productHeroVisual robotHero" aria-label="Nodra autonomous AI protection"><div className="robotHalo"/><div className="robotHead"><div className="robotCrown"/><div className="robotFace"><i className="eye left"/><i className="eye right"/></div><div className="robotJaw"/></div><div className="robotShoulders"/><div className="robotScan"/><span className="robotTag"><ShieldCheck/> AUTONOMOUS AI • PROTECTED BY NODRA</span></div></section>
<section className="productFeatures shell" id="product">{features.map(({icon:Icon,title,body})=><article key={title}><Icon/><h3>{title}</h3><p>{body}</p></article>)}</section>
<section className="productFlow" id="security"><div className="shell"><span className="productEyebrow">HOW NODRA WORKS</span><h2>From agent intent to trusted action.</h2><p className="flowLead">Nodra sits between autonomous agents and consequential tools, enforcing identity, authority and policy before execution.</p><div className="flowSteps"><div><span>1</span><Users/><b>Agent requests action</b></div><i>→</i><div><span>2</span><ShieldCheck/><b>Verify identity & authority</b></div><i>→</i><div><span>3</span><Network/><b>Evaluate policy & context</b></div><i>→</i><div className="decisionStep"><span>4</span><CheckCircle2/><b>Allow / Approval / Deny</b></div><i>→</i><div><span>5</span><FileCheck2/><b>Preserve evidence</b></div></div></div></section>
<section className="developerBand shell" id="developers"><div><span className="productEyebrow">FOR DEVELOPERS</span><h2>Integrate Nodra with the agents you already run.</h2><p>Register an agent, define its authority, issue an integration credential, then send signed authorization and evidence requests to the Nodra gateway.</p><a href="/docs">Read developer documentation →</a></div><div className="codeCard"><div className="codeTabs"><b>JavaScript / TypeScript</b><span>Python</span><span>REST API</span><span>MCP</span></div><pre>{`const agent = nodra.protect({ id: "finance-agent" });

const decision = await agent.authorize({
  resourceId: "payments",
  action: "send_payment"
});

if (decision.decision !== "allow") {
  // stop execution or route for approval
}`}</pre><small>Public package distribution is not advertised until release.</small></div></section>
<section className="solutionsBand shell" id="solutions"><div><span className="productEyebrow">BUILT FOR REAL TEAMS</span><h2>One control plane. Different responsibilities.</h2></div><div className="solutionCards"><article><Code2/><h3>Developers</h3><p>Register agents, integrate signed requests, test connections, and inspect runtime evidence.</p><a href="/docs">Developer docs →</a></article><article><ShieldCheck/><h3>Security Teams</h3><p>Investigate evidence, understand causal paths, contain affected agents, and manage recovery.</p><a href="#security">Security model →</a></article><article><Building2/><h3>Organizations</h3><p>Define authority and policies across workspaces while keeping agent activity accountable.</p><GitHubAuthButton className="inlineStart">Get started →</GitHubAuthButton></article></div></section>
<section className="productCta"><div className="shell"><div><span className="productEyebrow">START WITH ONE AGENT</span><h2>Put control between AI intent and real-world consequences.</h2><p>Create a workspace and protect your first agent with Nodra.</p></div><GitHubAuthButton className="productPrimary">Get Started →</GitHubAuthButton></div></section>
<footer className="productFooter shell"><div className="footerBrand"><a className="productBrand" href="#top"><img src="/nodra-logo.webp" alt="Nodra"/><strong>NODRA</strong></a><p>Security control infrastructure for autonomous AI agents.</p></div><div><b>Product</b><a href="#product">Overview</a><a href="#security">Security</a></div><div><b>Developers</b><a href="/docs">Documentation</a><a href="#developers">Integration</a></div><div><b>Company</b><span>© 2026 Nodra</span></div></footer>
</main>}