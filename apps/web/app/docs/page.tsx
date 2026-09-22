import Link from "next/link";
const sections=[
["quickstart","Quickstart","Choose an integration path and connect your first agent action to Nodra."],
["javascript","JavaScript / TypeScript","Use the repository SDK workspace while the public npm distribution is being prepared."],
["python","Python SDK","Integrate Python agents with the repository Python SDK and Nodra gateway."],
["rest-api","REST API","Call the Nodra authorization gateway directly from services that do not use an SDK."],
["authentication","Authentication & credentials","Keep credentials server-side and associate requests with the correct Nodra workspace."],
["policies","Policies & authorization","Define explicit authority boundaries and decide whether an action is allowed, blocked, or requires approval."],
["events","Events & provenance","Record consequential actions and preserve evidence about authority and downstream effects."],
["containment","Containment","Isolate affected agents or branches without unnecessarily stopping unaffected systems."],
["recovery","Recovery","Review incident state, credentials, jobs, and affected resources before safe restart."],
["security","Security model","Understand the control plane, workspace isolation, evidence, and recovery boundaries."]
];
export default function DocsPage(){return <main className="docsPage"><header className="docsTop"><Link href="/" className="docsLogo"><img src="/nodra-logo.png" alt="Nodra"/></Link><div>Documentation</div><Link href="/" className="docsBack">← Back to Nodra</Link></header><div className="docsLayout"><aside className="docsSide"><strong>GET STARTED</strong><a href="#quickstart">Quickstart</a><strong>INTEGRATIONS</strong><a href="#javascript">JavaScript / TypeScript</a><a href="#python">Python</a><a href="#rest-api">REST API</a><strong>PLATFORM</strong><a href="#authentication">Authentication</a><a href="#policies">Policies & authorization</a><a href="#events">Events & provenance</a><a href="#containment">Containment</a><a href="#recovery">Recovery</a><a href="#security">Security</a></aside><article className="docsContent"><div className="docsEyebrow">NODRA DOCUMENTATION</div><h1>Secure agent actions with explicit boundaries.</h1><p className="docsLead">Nodra sits between autonomous agents and consequential tools. These docs describe the product interfaces that developers integrate with; they do not require access to Nodra's internal platform source.</p><section id="quickstart"><h2>Quickstart</h2><p>1. Create or select a Nodra workspace. 2. Register the agent that will request authorization. 3. Configure its allowed actions and resources. 4. Send consequential actions through Nodra before execution. 5. Review resulting evidence and security events in the console.</p><div className="docsNotice"><strong>Distribution status</strong><span>Nodra's SDK workspaces exist in the product repository. Public npm/PyPI packages are not advertised as released until their registry publication is complete.</span></div></section>{sections.slice(1).map(([id,title,body])=><section id={id} key={id}><h2>{title}</h2><p>{body}</p>{id==="rest-api"&&<pre><code>{`POST /api/gateway/authorize
Content-Type: application/json
x-nodra-credential: <agent integration credential>
x-nodra-timestamp: <unix seconds>
x-nodra-nonce: <uuid>
x-nodra-signature: v1=<hmac-sha256>

{
  "agentId": "finance-agent",
  "resourceId": "payments",
  "action": "send_payment"
}

// Signature canonical form:
// v1\\n<timestamp>\\n<nonce>\\n<sha256(body)>`}</code></pre>}{id==="javascript"&&<pre><code>{`// Public npm distribution is being prepared.
// The SDK currently lives in packages/sdk.`}</code></pre>}{id==="python"&&<pre><code>{`# Python SDK distribution is being prepared.
# Use the repository SDK during development.`}</code></pre>}</section>)}</article><aside className="docsToc"><strong>ON THIS PAGE</strong>{sections.map(([id,title])=><a href={"#"+id} key={id}>{title}</a>)}</aside></div></main>}