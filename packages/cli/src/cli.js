#!/usr/bin/env node
const [command,...args]=process.argv.slice(2);
const base=(process.env.NODRA_BASE_URL||"").replace(/\/$/,""),credential=process.env.NODRA_CREDENTIAL||"",agentId=process.env.NODRA_AGENT_ID||"";
const help=`
Nodra CLI
  nodra init       Print secure runtime configuration
  nodra connect    Verify Nodra cloud reachability
  nodra status     Check this agent's protection status
  nodra doctor     Validate local configuration and cloud health
  nodra help       Show this help
`;
function local(){
 const missing=[];if(!base)missing.push("NODRA_BASE_URL");if(!agentId)missing.push("NODRA_AGENT_ID");if(!credential)missing.push("NODRA_CREDENTIAL");
 return {ok:missing.length===0&&credential.length>=32,missing,credentialLength:credential.length};
}
async function cloudHealth(){if(!base)return {ok:false,error:"NODRA_BASE_URL missing"};try{const r=await fetch(base+"/api/health",{headers:{"user-agent":"nodra-cli/0.1"}});return {ok:r.ok,status:r.status}}catch(e){return {ok:false,error:e instanceof Error?e.message:"connection_failed"}}}
if(!command||command==="help"||command==="--help"){console.log(help);process.exit(0)}
if(command==="init"){console.log("Set these server-side environment variables:\nNODRA_BASE_URL=https://your-nodra-host\nNODRA_AGENT_ID=your-agent-id\nNODRA_CREDENTIAL=<ndra_ credential>\n\nNever expose NODRA_CREDENTIAL to browser or mobile code.");process.exit(0)}
if(command==="connect"){const h=await cloudHealth();console.log(h.ok?"Nodra cloud reachable.":"Nodra cloud unavailable.",h);process.exit(h.ok?0:1)}
if(command==="status"){const l=local();if(!l.ok){console.error("Protection configuration incomplete.",l);process.exit(1)}const h=await cloudHealth();console.log(JSON.stringify({configured:true,cloudReachable:h.ok,agentId},null,2));process.exit(h.ok?0:1)}
if(command==="doctor"){const l=local();if(!l.ok){console.error("Nodra configuration incomplete.",l);process.exit(1)}const h=await cloudHealth();if(!h.ok){console.error("Local configuration is valid, but Nodra cloud is unreachable.",h);process.exit(1)}console.log("Nodra doctor: local secrets, agent identity and cloud reachability look ready.");process.exit(0)}
console.error("Unknown Nodra command: "+command);console.log(help);process.exit(1);
