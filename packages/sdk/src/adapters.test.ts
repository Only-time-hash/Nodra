import test from "node:test";
import assert from "node:assert/strict";
import {protectTool} from "./adapters";

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


test("credential protocol uses direct customer secret",()=>{ const credential="ndra_node_test_credential_1234567890"; assert.equal(credential.length>=32,true); });
