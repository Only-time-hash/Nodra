import test from "node:test";
import assert from "node:assert/strict";
import { createFlightRecorderObserver } from "./gateway-observer.ts";

const identity={workspaceId:"11111111-1111-4111-8111-111111111111",agentId:"22222222-2222-4222-8222-222222222222",masterSecret:"x".repeat(32)};
const event={id:"evt-1",agentId:"research",resourceId:"browser",action:"read",decision:"allow" as const,reason:"authorized test observation",phase:"intent" as const,executed:false,occurredAt:new Date().toISOString(),timestamp:new Date().toISOString()};

test("flight recorder rejection fails closed", async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=(async()=>new Response("unavailable",{status:503})) as typeof fetch;
  try{
    const observer=createFlightRecorderObserver({endpoint:"https://recorder.invalid/events",signingIdentity:identity});
    await assert.rejects(()=>Promise.resolve(observer(event)),/flight recorder rejected gateway event: 503/);
  } finally { globalThis.fetch=originalFetch; }
});

test("flight recorder network outage fails closed", async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=(async()=>{throw new Error("network unavailable")}) as typeof fetch;
  try{
    const observer=createFlightRecorderObserver({endpoint:"https://recorder.invalid/events",signingIdentity:identity});
    await assert.rejects(()=>Promise.resolve(observer(event)),/network unavailable/);
  } finally { globalThis.fetch=originalFetch; }
});
