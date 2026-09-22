"use client";
import { useState } from "react";
const sdk={
 js:{label:"JavaScript / TypeScript",command:"npm install @nodra/sdk",note:"Workspace SDK",quick:"JavaScript quickstart"},
 py:{label:"Python",command:"python -m pip install -e packages/python-sdk",note:"Repository Python SDK",quick:"Python quickstart"},
 rest:{label:"REST API",command:"POST /api/gateway/authorize",note:"Nodra gateway endpoint",quick:"REST API quickstart"}
} as const;
export function IntegrationChooser(){const [active,setActive]=useState<keyof typeof sdk>("js");const item=sdk[active];async function copy(){try{await navigator.clipboard.writeText(item.command)}catch{}}return <div className="integrationChooser"><div className="sdkTabs" role="tablist">{(Object.entries(sdk) as [keyof typeof sdk,(typeof sdk)[keyof typeof sdk]][]).map(([key,x])=><button key={key} type="button" role="tab" aria-selected={active===key} className={active===key?"active":""} onClick={()=>setActive(key)}>{x.label}</button>)}</div><div className="installLine"><div><code>{item.command}</code><small>{item.note}</small></div><button type="button" onClick={copy} aria-label={"Copy "+item.label+" command"}>⧉</button></div><a href="#documentation" className="inlineLink">View {item.quick} →</a></div>}