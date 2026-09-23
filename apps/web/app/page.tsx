import { GitHubAuthButton } from "../components/github-auth-button";
import { ArrowRight, ShieldCheck, Search, Database, UserRound, Box, AlertCircle, X, Check, Settings } from "lucide-react";
import "./home-realistic.css";

function NodraMark({small=false}:{small?:boolean}){return <svg className={small?"nhMark nhMarkSmall":"nhMark"} viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="8"/><path d="M32 3c8 0 13 4 16 10-7 0-12 4-16 11-4-7-9-11-16-11C19 7 24 3 32 3Z"/><path d="M61 32c0 8-4 13-10 16 0-7-4-12-11-16 7-4 11-9 11-16 6 3 10 8 10 16Z"/><path d="M32 61c-8 0-13-4-16-10 7 0 12-4 16-11 4 7 9 11 16 11-3 6-8 10-16 10Z"/><path d="M3 32c0-8 4-13 10-16 0 7 4 12 11 16-7 4-11 9-11 16C7 45 3 40 3 32Z"/></svg>}

function GitHubMark(){return <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.02c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.29-5.27-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18A10.9 10.9 0 0 1 12 6.33c.98 0 1.95.13 2.86.39 2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.4-2.71 5.38-5.29 5.67.42.36.79 1.07.79 2.16v3.04c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"/></svg>}

const Layer=({kind,title,sub,children}:{kind:string,title:string,sub:string,children:React.ReactNode})=><div className={"nhLayer "+kind}><span className="nhLayerIcon">{children}</span><span><b>{title}</b><small>{sub}</small></span></div>;

export default function HomePage(){return <main className="nhHome" id="top"><div className="nhFrame">
<header className="nhNav">
<a className="nhBrand" href="#top"><NodraMark/><b>Nodra</b></a>
<nav aria-label="Primary"><a href="#product">Product⌄</a><a href="#solutions">Solutions⌄</a><a href="#developers">Developers</a><a href="/docs">Resources⌄</a></nav>
<div className="nhActions"><a className="nhGithub" href="https://github.com/Only-time-hash/Nodra" aria-label="GitHub"><GitHubMark/></a><GitHubAuthButton className="nhSign">Sign in</GitHubAuthButton><GitHubAuthButton className="nhPrimary">Get started <ArrowRight/></GitHubAuthButton></div>
</header>
<section className="nhHero">
<div className="nhHeroCopy"><span className="nhEyebrow">THE AI AGENT SECURITY PLATFORM</span><h1>Secure what your<br/>AI agents can<br/><em>actually do.</em></h1><p>Nodra helps you control, monitor and protect AI agents across your tools, data and infrastructure — so they can be useful, without being risky.</p><div className="nhCtas"><GitHubAuthButton className="nhPrimary nhLarge">Get started <ArrowRight/></GitHubAuthButton><a className="nhOutline" href="/docs">Read the docs</a></div><div className="nhSignals"><span><ShieldCheck/><b>Control</b><small>authority and access</small></span><span><Search/><b>Detect</b><small>and stop risky actions</small></span><span><Database/><b>Investigate</b><small>and recover quickly</small></span></div></div>
<div className="nhSystem" aria-label="Nodra security control layer">
<div className="nhAgent"><div className="nhAgentTitle"><UserRound/> <b>AI Agent</b></div><span><Search/>Research</span><span><Settings/>Analyze</span><span><AlertCircle/>Take action</span></div>
<div className="nhStack"><div className="nhStackCap"><NodraMark small/></div><Layer kind="identity" title="Identity" sub="Who is acting?"><Box/></Layer><Layer kind="authority" title="Authority" sub="What can it do?"><ShieldCheck/></Layer><Layer kind="policy" title="Policy Enforcement" sub="Is it allowed?"><Box/></Layer><Layer kind="evidence" title="Monitoring & Evidence" sub="What happened?"><Database/></Layer><div className="nhBase"><b>Nodra</b><span>Security Layer</span></div></div>
<div className="nhOutcomes"><div className="nhOutcome allowed"><i><Check/></i><span><b>Allowed</b><small>Safe action proceeds</small></span></div><div className="nhOutcome approval"><i>!</i><span><b>Requires Approval</b><small>Human review needed</small></span></div><div className="nhOutcome blocked"><i><X/></i><span><b>Blocked</b><small>Risky action stopped</small></span></div></div>
</div>
</section></div></main>}