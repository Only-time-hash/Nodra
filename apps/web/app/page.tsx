import { GitHubAuthButton } from "../components/github-auth-button";
import { ArrowRight, ChevronDown, ShieldCheck, Search, Database } from "lucide-react";
import "./home-realistic.css";

function NodraLogo(){return <svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="nl" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#13b8ff"/><stop offset="1" stopColor="#126cff"/></linearGradient></defs><g fill="url(#nl)"><path d="M31 5C20 5 13 10 9 19c9-1 16 3 22 12V5Z"/><path d="M59 31c0-11-5-18-14-22 1 9-3 16-12 22h26Z"/><path d="M33 59c11 0 18-5 22-14-9 1-16-3-22-12v26Z"/><path d="M5 33c0 11 5 18 14 22-1-9 3-16 12-22H5Z"/></g><circle cx="32" cy="32" r="7" fill="#051b3c"/></svg>}
function GitHubMark(){return <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.02c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.29-5.27-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18A10.9 10.9 0 0 1 12 6.33c.98 0 1.95.13 2.86.39 2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.4-2.71 5.38-5.29 5.67.42.36.79 1.07.79 2.16v3.04c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"/></svg>}

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
</section></main>}