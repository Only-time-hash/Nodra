import test from "node:test";
import assert from "node:assert/strict";
import { PostExecutionObservationError, createObservableGateway } from "./observable-gateway.ts";

test("allowed tool executes and is observed",async()=>{
 const observed:any[]=[]; let calls=0;
 const gateway=createObservableGateway([{agentId:"research",resourceId:"notes",actions:["write"]}],async e=>{observed.push(e)});
 gateway.register("notes",async()=>{calls++;return {saved:true}});
 const result=await gateway.execute({id:"evt-allow",agentId:"research",resourceId:"notes",action:"write"},{text:"safe"});
 assert.equal(result.executed,true); assert.equal(calls,1); assert.equal(result.event.decision,"allow");
 assert.equal(observed.length,2); assert.equal(observed[0].phase,"intent"); assert.equal(observed[1].phase,"result"); assert.equal(observed[1].executed,true);
});

test("unauthorized tool never executes and denial is observed",async()=>{
 const observed:any[]=[]; let calls=0;
 const gateway=createObservableGateway([{agentId:"research",resourceId:"notes",actions:["write"]}],async e=>{observed.push(e)});
 gateway.register("payments",async()=>{calls++;return {paid:true}});
 const result=await gateway.execute({id:"evt-deny",agentId:"research",resourceId:"payments",action:"request"},{amount:100});
 assert.equal(result.executed,false); assert.equal(calls,0); assert.equal(result.event.decision,"deny");
 assert.equal(observed.length,2); assert.equal(observed[0].phase,"intent"); assert.equal(observed[1].decision,"deny"); assert.equal(observed[1].executed,false);
});

test("missing adapter fails closed and is observed as denied",async()=>{
 const observed:any[]=[];
 const gateway=createObservableGateway([{agentId:"research",resourceId:"browser",actions:["read"]}],async e=>{observed.push(e)});
 const result=await gateway.execute({id:"evt-missing",agentId:"research",resourceId:"browser",action:"read"},{url:"sandbox"});
 assert.equal(result.executed,false); assert.equal(result.event.decision,"deny");
 assert.match(result.event.reason,/No registered tool adapter/); assert.equal(observed.length,2); assert.equal(observed[1].decision,"deny");
});


test("quarantined agent is denied before tool execution",async()=>{
 const observed:any[]=[]; let calls=0;
 const gateway=createObservableGateway(
  [{agentId:"research",resourceId:"notes",actions:["write"]}],
  async e=>{observed.push(e)},
  {},
  async()=> "quarantined",
 );
 gateway.register("notes",async()=>{calls++;return {saved:true}});
 const result=await gateway.execute({id:"evt-quarantine",agentId:"research",resourceId:"notes",action:"write"},{});
 assert.equal(result.executed,false); assert.equal(calls,0); assert.equal(result.event.decision,"deny");
 assert.match(result.event.reason,/quarantined/i); assert.equal(observed[0].phase,"intent"); assert.equal(observed[1].phase,"result");
});


test("approval-required action fails closed without approval resolver",async()=>{
 let calls=0;
 const gateway=createObservableGateway([{agentId:"finance",resourceId:"payments",actions:["pay"],requireApprovalAbove:10}],async()=>{});
 gateway.register("payments",async()=>{calls++;return {paid:true}});
 const result=await gateway.execute({id:"approval-1",agentId:"finance",resourceId:"payments",action:"pay",amount:50},{});
 assert.equal(result.executed,false); assert.equal(calls,0);
});


test("timeout aborts cooperative tool adapter",async()=>{
 let aborted=false;
 const gateway=createObservableGateway([{agentId:"research",resourceId:"slow",actions:["read"]}],async()=>{});
 gateway.register("slow",async(_input,signal)=>new Promise((_resolve,reject)=>{
   signal?.addEventListener("abort",()=>{aborted=true;reject(new Error("aborted"));});
 }),{timeoutMs:5});
 await assert.rejects(()=>gateway.execute({id:"timeout-abort",agentId:"research",resourceId:"slow",action:"read"},{}));
 assert.equal(aborted,true);
});

test("input validator blocks adapter before invocation",async()=>{
 let calls=0;
 const gateway=createObservableGateway([{agentId:"data",resourceId:"database",actions:["write"]}],async()=>{});
 gateway.register("database",async()=>{calls++;return {ok:true}},{validateInput:(v)=>typeof v==="object"&&v!==null&&"record" in v});
 const result=await gateway.execute({id:"validation-block",agentId:"data",resourceId:"database",action:"write"},{bad:true});
 assert.equal(result.executed,false); assert.equal(calls,0); assert.match(result.event.reason,/validation failed/i);
});


test("recorder intent failure prevents protected adapter execution",async()=>{
 let calls=0;
 const gateway=createObservableGateway(
  [{agentId:"research",resourceId:"notes",actions:["write"]}],
  async event=>{ if(event.phase==="intent") throw new Error("recorder unavailable"); },
 );
 gateway.register("notes",async()=>{calls++;return {saved:true}});
 await assert.rejects(
  ()=>gateway.execute({id:"recorder-fail",agentId:"research",resourceId:"notes",action:"write"},{text:"must not execute"}),
  /recorder unavailable/,
 );
 assert.equal(calls,0);
});


test("post-execution recorder failure is explicitly non-retryable", async()=>{
 let calls=0;
 const gateway=createObservableGateway(
  [{agentId:"research",resourceId:"notes",actions:["write"]}],
  async event=>{ if(event.phase==="result"&&event.executed) throw new Error("recorder unavailable"); },
 );
 gateway.register("notes",async()=>{calls++;return {saved:true}});
 await assert.rejects(
  ()=>gateway.execute({id:"result-recorder-fail",agentId:"research",resourceId:"notes",action:"write"},{text:"execute once"}),
  (error:unknown)=>error instanceof PostExecutionObservationError && error.executed===true && error.requestId==="result-recorder-fail",
 );
 assert.equal(calls,1);
});


test("persistent result-recorder outage cannot mask completed execution", async()=>{
 let calls=0;
 const gateway=createObservableGateway(
  [{agentId:"research",resourceId:"notes",actions:["write"]}],
  async event=>{ if(event.phase==="result") throw new Error("recorder persistently unavailable"); },
 );
 gateway.register("notes",async()=>{calls++;return {saved:true}});
 await assert.rejects(
  ()=>gateway.execute({id:"persistent-result-outage",agentId:"research",resourceId:"notes",action:"write"},{text:"execute exactly once"}),
  (error:unknown)=>error instanceof PostExecutionObservationError && error.executed===true && error.requestId==="persistent-result-outage",
 );
 assert.equal(calls,1);
});

test("recorder outage while reporting tool failure preserves the tool failure", async()=>{
 let calls=0;
 const gateway=createObservableGateway(
  [{agentId:"research",resourceId:"notes",actions:["write"]}],
  async event=>{ if(event.phase==="result") throw new Error("recorder unavailable"); },
 );
 gateway.register("notes",async()=>{calls++;throw new Error("adapter exploded");});
 await assert.rejects(
  ()=>gateway.execute({id:"tool-and-recorder-fail",agentId:"research",resourceId:"notes",action:"write"},{text:"fail once"}),
  /adapter exploded/,
 );
 assert.equal(calls,1);
});
