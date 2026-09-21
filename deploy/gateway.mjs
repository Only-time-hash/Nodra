import http from "node:http";
import {createHash,createHmac,randomUUID} from "node:crypto";

const port=Number(process.env.PORT||8787);
const base=(process.env.NODRA_BASE_URL||"").replace(/\/$/,"");
const workspaceId=process.env.NODRA_WORKSPACE_ID||"";
const secret=process.env.NODRA_GATEWAY_SIGNING_SECRET||"";
if(!base||!workspaceId||secret.length<32)throw new Error("NODRA_BASE_URL, NODRA_WORKSPACE_ID and a 32+ character NODRA_GATEWAY_SIGNING_SECRET are required.");

function headers(body,agentId){
 const timestamp=String(Math.floor(Date.now()/1000)),nonce=randomUUID();
 const key=createHmac("sha256",secret).update("nodra-agent-key-v1\n"+workspaceId+"\n"+agentId).digest();
 const digest=createHash("sha256").update(body).digest("hex");
 const signature=createHmac("sha256",key).update("v1\n"+timestamp+"\n"+nonce+"\n"+digest).digest("hex");
 return {"content-type":"application/json","x-nodra-timestamp":timestamp,"x-nodra-nonce":nonce,"x-nodra-signature":"v1="+signature};
}
async function read(req){let body="";for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>65536)throw new Error("request_too_large")}return body}
function json(res,status,data){res.writeHead(status,{"content-type":"application/json","cache-control":"no-store"});res.end(JSON.stringify(data))}
const server=http.createServer(async(req,res)=>{
 try{
  if(req.method==="GET"&&req.url==="/health")return json(res,200,{ok:true,service:"nodra-gateway"});
  const target=req.url==="/authorize"?"/api/gateway/authorize":req.url==="/events"?"/api/gateway/events":null;
  if(req.method!=="POST"||!target)return json(res,404,{error:"not_found"});
  const body=await read(req),parsed=JSON.parse(body);
  if(!parsed?.agentId||typeof parsed.agentId!=="string")return json(res,400,{error:"agent_id_required"});
  const upstream=await fetch(base+target,{method:"POST",headers:headers(body,parsed.agentId),body,signal:AbortSignal.timeout(15000)});
  const text=await upstream.text();res.writeHead(upstream.status,{"content-type":upstream.headers.get("content-type")||"application/json","cache-control":"no-store"});res.end(text);
 }catch(error){json(res,error?.message==="request_too_large"?413:502,{error:error?.message==="request_too_large"?"request_too_large":"gateway_upstream_failure"})}
});
server.listen(port,()=>console.log("Nodra gateway listening on :"+port));
