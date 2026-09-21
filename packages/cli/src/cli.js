#!/usr/bin/env node
const [command]=process.argv.slice(2);
const help=`
Nodra CLI

Commands:
  nodra init       Create local Nodra integration config
  nodra doctor     Validate required integration settings
  nodra help       Show this help
`;
if(!command||command==="help"||command==="--help"){console.log(help);process.exit(0)}
if(command==="doctor"){
 const required=["NODRA_BASE_URL","NODRA_WORKSPACE_ID","NODRA_GATEWAY_SIGNING_SECRET"];
 const missing=required.filter(k=>!process.env[k]);
 if(missing.length){console.error("Nodra configuration incomplete. Missing: "+missing.join(", "));process.exit(1)}
 if(process.env.NODRA_GATEWAY_SIGNING_SECRET.length<32){console.error("NODRA_GATEWAY_SIGNING_SECRET must contain at least 32 characters.");process.exit(1)}
 console.log("Nodra configuration looks ready.");process.exit(0)
}
if(command==="init"){
 console.log("Add these server-side environment variables:");
 console.log("NODRA_BASE_URL=https://your-nodra-host");
 console.log("NODRA_WORKSPACE_ID=your-workspace-id");
 console.log("NODRA_GATEWAY_SIGNING_SECRET=<32+ character secret>");
 console.log("\nNever expose the signing secret to browser or mobile code.");process.exit(0)
}
console.error("Unknown Nodra command: "+command);console.log(help);process.exit(1);
