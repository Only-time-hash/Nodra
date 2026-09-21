import test from "node:test";
import assert from "node:assert/strict";
import {protectTool} from "./adapters.ts";
import {Nodra} from "./index.ts";
import {createHash,createHmac} from "node:crypto";

test("deny never executes protected tool",async()=>{
 let ran=false;const nodra:any={authorize:async()=>({decision:"deny",reason:"policy"}),record:async()=>{}};
 const out=await protectTool(nodra,{agentId:"a",resourceId:"r",action:"write"},async()=>{ran=true;return 1});
 assert.equal(ran,false);assert.equal(out.executed,false);
});
test("require-approval never executes protected tool",async()=>{
 let ran=false;const nodra:any={authorize:async()=>({decision:"require-approval",reason:"scope"}),record:async()=>{}};
 const out=await protectTool(nodra,{agentId:"a",resourceId:"r",action:"write"},async()=>{ran=true;return 1});
 assert.equal(ran,false);assert.equal(out.executed,false);
});
test("allow executes once and records result",async()=>{
 let runs=0,records=0;const nodra:any={authorize:async()=>({decision:"allow",reason:"scope"}),record:async()=>{records++}};
 const out=await protectTool(nodra,{agentId:"a",resourceId:"r",action:"read"},async()=>{runs++;return 42});
 assert.equal(out.executed,true);assert.equal(out.result,42);assert.equal(runs,1);assert.equal(records,1);
});


test("Node SDK sends customer credential and a valid HMAC",async()=>{
 const credential="ndra_node_test_credential_1234567890";
 const originalFetch=globalThis.fetch;
 let captured:any;
 globalThis.fetch=async(input:any,init:any)=>{captured={input,init};return new Response(JSON.stringify({decision:"allow",reason:"test",agentId:"agent-1",resourceId:"web",action:"search"}),{status:200,headers:{"content-type":"application/json"}})};
 try{
  const client=new Nodra({baseUrl:"https://nodra.example",workspaceId:"workspace-1",credential});
  await client.authorize({agentId:"agent-1",resourceId:"web",action:"search"});
  assert.equal(captured.init.headers["x-nodra-credential"],credential);
  const timestamp=captured.init.headers["x-nodra-timestamp"],nonce=captured.init.headers["x-nodra-nonce"];
  const digest=createHash("sha256").update(captured.init.body).digest("hex");
  const expected="v1="+createHmac("sha256",credential).update("v1\n"+timestamp+"\n"+nonce+"\n"+digest).digest("hex");
  assert.equal(captured.init.headers["x-nodra-signature"],expected);
 }finally{globalThis.fetch=originalFetch}
});
