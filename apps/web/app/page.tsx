import { GitHubAuthButton } from "../components/github-auth-button";
import { ArrowRight, ChevronDown, ShieldCheck, Search, Database, FileText, Radio, TriangleAlert, ScanSearch, RotateCcw } from "lucide-react";
import "./home-realistic.css";

function NodraLogo(){return <svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="nl" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#13b8ff"/><stop offset="1" stopColor="#126cff"/></linearGradient></defs><g fill="url(#nl)"><path d="M31 5C20 5 13 10 9 19c9-1 16 3 22 12V5Z"/><path d="M59 31c0-11-5-18-14-22 1 9-3 16-12 22h26Z"/><path d="M33 59c11 0 18-5 22-14-9 1-16-3-22-12v26Z"/><path d="M5 33c0 11 5 18 14 22-1-9 3-16 12-22H5Z"/></g><circle cx="32" cy="32" r="7" fill="#051b3c"/></svg>}
function GitHubMark(){return <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.02c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.29-5.27-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18A10.9 10.9 0 0 1 12 6.33c.98 0 1.95.13 2.86.39 2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.4-2.71 5.38-5.29 5.67.42.36.79 1.07.79 2.16v3.04c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"/></svg>}
function BrandIcon({brand}:{brand:string}){const paths:Record<string,string>={openai:"M12 2.4a4.8 4.8 0 0 1 4.15 2.4 4.8 4.8 0 0 1 4.15 7.2 4.8 4.8 0 0 1-4.15 7.2A4.8 4.8 0 0 1 7.85 19.2 4.8 4.8 0 0 1 3.7 12a4.8 4.8 0 0 1 4.15-7.2A4.8 4.8 0 0 1 12 2.4Zm0 3.1-3.7 2.14v4.72L12 14.5l3.7-2.14V7.64L12 5.5Zm-5.1 3.2L5.2 9.68v4.28l3.7 2.14 1.7-.98-3.7-2.14V8.7Zm10.2 0v4.28l-3.7 2.14 1.7.98 3.7-2.14V9.68L17.1 8.7Z",anthropic:"M4.1 19 9.35 5h2.8L17.4 19h-3l-1.1-3.2H8.2L7.1 19h-3Zm5-5.8h3.3l-1.65-4.9-1.65 4.9ZM18 5h2v14h-2V5Z",google:"M12 3a9 9 0 1 0 0 18c4.85 0 8.4-3.4 8.4-8.2 0-.58-.06-1.02-.14-1.47H12v3.1h4.85c-.2 1.02-.8 1.9-1.7 2.5v2.07h2.75A8.25 8.25 0 0 0 20.4 12.8C20.4 7.3 16.55 3 12 3Z",microsoft:"M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z",aws:"M4 15.2c4.7 3.45 11.15 3.75 16.25.65.8-.48 1.55.7.7 1.25-5.8 3.8-13.45 3.35-18.7-.7-.7-.55.05-1.75.8-1.2H4Zm14.55-2.05c.75-.9 1.35-2.4.85-3.45-.4-.85-1.55-.75-2.35-.6l.25-1.35c1.65-.3 3.75-.2 4.35 1.45.55 1.55-.55 3.75-1.65 4.8l-1.45-.85Z",vercel:"M12 4 22 20H2L12 4Z",notion:"M4 3.5 17.2 2l2.8 2.1v15.8L6.1 22 4 19.8V3.5Zm3.1 3.3v10.8l2.2-.4V9.8l6.25 7.05 1.45-.3V6.2l-2 .35v6.8L9 6.55l-1.9.25Z"};return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[brand]} fill="currentColor"/></svg>}

function BrandLogo({slug,name}:{slug:string;name:string}){return <img className="nhBrandLogo" src={`/brands/${slug}.svg`} alt={`${name} logo`} loading="lazy"/>}


export default function HomePage(){return <main className="nhPage"><section className="nhHeroCard" id="top">
<header className="nhNav">
<a className="nhBrand" href="#top"><span className="nhLogo"><NodraLogo/></span><b>Nodra</b></a>
<nav aria-label="Primary"><a className="nhNavDrop" href="#product"><span>Product</span><ChevronDown/></a><a className="nhNavDrop" href="#solutions"><span>Solutions</span><ChevronDown/></a><a href="#developers">Developers</a><a className="nhNavDrop" href="/docs"><span>Resources</span><ChevronDown/></a></nav>
<div className="nhActions"><a className="nhGithub" href="https://github.com/Only-time-hash/Nodra" aria-label="GitHub"><GitHubMark/></a><GitHubAuthButton className="nhSign">Sign in</GitHubAuthButton><GitHubAuthButton className="nhPrimary">Get started <ArrowRight/></GitHubAuthButton></div>
</header>
<div className="nhHeroBody">
<div className="nhHeroCopy"><span className="nhEyebrow">THE AI AGENT SECURITY PLATFORM</span><h1>Secure what your<br/>AI agents can<br/><em>actually do.</em></h1><p>Nodra helps you control, monitor and protect AI agents across your tools, data and infrastructure — so they can be useful, without being risky.</p><div className="nhCtas"><GitHubAuthButton className="nhPrimary nhLarge">Get started <ArrowRight/></GitHubAuthButton><a className="nhOutline" href="/docs">Read the docs</a></div><div className="nhSignals"><span><ShieldCheck/><b>Control</b><small>authority and access</small></span><span><Search/><b>Detect</b><small>and stop risky actions</small></span><span><Database/><b>Investigate</b><small>and recover quickly</small></span></div></div>
<div className="nhVisual" aria-label="Nodra security control layer"><img src="/nodra-security-hero.png" alt="AI Agent passing through Nodra identity, authority, policy and evidence controls to allowed, approval or blocked outcomes"/></div>
</div>
</section>
<section className="nhControl" id="product">
<div className="nhRise" aria-hidden="true">{Array.from({length:26}).map((_,i)=><i key={i} style={{"--i":i} as React.CSSProperties}/>)}</div>
<div className="nhControlTop">
<div className="nhControlCopy"><span className="nhSectionTag">WHY NODRA</span><h2>Secure AI agents<br/>at <em>every layer.</em></h2><p>Nodra gives you complete control over your AI agents with real-time visibility, policy enforcement and automated protection across your entire stack.</p><div className="nhStats"><span><b>100%</b><small>Action traceability</small></span><span><b>&lt; 1s</b><small>Threat response</small></span><span><b>24/7</b><small>Continuous monitoring</small></span></div></div>
<div className="nhFloating"><img src="/flosting.png" alt="Nodra protection layers for agents, policy, runtime, monitoring, tools and infrastructure"/></div>
</div>
<div className="nhCapabilities">
<div className="nhCapIntro"><div><span className="nhSectionTag">CORE CAPABILITIES</span><h3>Everything you need to keep<br/>AI agents <em>safe and productive.</em></h3></div><p>From access control to incident recovery, Nodra provides end-to-end security for your AI agents — without slowing them down.</p></div>
<div className="nhCapGrid">
<article><ShieldCheck/><b>Access Control</b><p>Define exactly what your agents can access and do.</p><a href="/docs" aria-label="Access Control details"><ArrowRight/></a></article>
<article><FileText/><b>Policy Enforcement</b><p>Automatically enforce security rules and permissions.</p><a href="/docs" aria-label="Policy Enforcement details"><ArrowRight/></a></article>
<article><Radio/><b>Real-time Monitoring</b><p>See every action, in real time, across all your agents.</p><a href="/docs" aria-label="Real-time Monitoring details"><ArrowRight/></a></article>
<article><TriangleAlert/><b>Incident Detection</b><p>Detect and stop risky or unauthorized behavior early.</p><a href="/docs" aria-label="Incident Detection details"><ArrowRight/></a></article>
<article><ScanSearch/><b>Investigation & Forensics</b><p>Trace, analyze and understand exactly what happened.</p><a href="/docs" aria-label="Investigation details"><ArrowRight/></a></article>
<article><RotateCcw/><b>Recovery & Restart</b><p>Safely contain incidents and get your agents back to work.</p><a href="/docs" aria-label="Recovery details"><ArrowRight/></a></article>
</div></div>
<div className="nhBuilder"><span className="nhSectionTag">AI ECOSYSTEM</span><h3>Built for the tools AI teams use.</h3><p>Nodra is being built to protect agent workflows across modern AI and cloud stacks.</p><div className="nhLogoRow" aria-label="AI and cloud ecosystem"><span><BrandLogo slug="openai" name="OpenAI"/>OpenAI</span><span><BrandLogo slug="anthropic" name="Anthropic"/>Anthropic</span><span><BrandLogo slug="google-cloud" name="Google Cloud"/>Google Cloud</span><span><BrandLogo slug="microsoft" name="Microsoft"/>Microsoft</span><span><BrandLogo slug="aws" name="AWS"/>AWS</span><span><BrandLogo slug="vercel" name="Vercel"/>Vercel</span><span><BrandLogo slug="notion" name="Notion"/>Notion</span></div><small className="nhBrandNote">Company names and marks identify ecosystem platforms only; they do not imply endorsement or partnership.</small></div>
</section>
</main>}