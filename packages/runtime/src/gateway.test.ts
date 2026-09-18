import test from "node:test";
import assert from "node:assert/strict";
import { createObservableGateway } from "./observable-gateway";

test("allowed tool executes and is observed",async()=>{
 const observed:any[]=[]; let calls=0;
 const gateway=createObservableGateway([{agentId:"research",resourceId:"notes",actions:["write"]}],async e=>{observed.push(e)});
 gateway.register("notes",async()=>{calls++;return {saved:true}});
 const result=await gateway.execute({id:"evt-allow",agentId:"research",resourceId:"notes",action:"write"},{text:"safe"});
 assert.equal(result.executed,true); assert.equal(calls,1); assert.equal(result.event.decision,"allow");
 assert.equal(observed.length,1); assert.equal(observed[0].executed,true);
});

test("unauthorized tool never executes and denial is observed",async()=>{
 const observed:any[]=[]; let calls=0;
 const gateway=createObservableGateway([{agentId:"research",resourceId:"notes",actions:["write"]}],async e=>{observed.push(e)});
 gateway.register("payments",async()=>{calls++;return {paid:true}});
 const result=await gateway.execute({id:"evt-deny",agentId:"research",resourceId:"payments",action:"request"},{amount:100});
 assert.equal(result.executed,false); assert.equal(calls,0); assert.equal(result.event.decision,"deny");
 assert.equal(observed.length,1); assert.equal(observed[0].decision,"deny"); assert.equal(observed[0].executed,false);
});

test("missing adapter fails closed and is observed as denied",async()=>{
 const observed:any[]=[];
 const gateway=createObservableGateway([{agentId:"research",resourceId:"browser",actions:["read"]}],async e=>{observed.push(e)});
 const result=await gateway.execute({id:"evt-missing",agentId:"research",resourceId:"browser",action:"read"},{url:"sandbox"});
 assert.equal(result.executed,false); assert.equal(result.event.decision,"deny");
 assert.match(result.event.reason,/No registered tool adapter/); assert.equal(observed[0].decision,"deny");
});
