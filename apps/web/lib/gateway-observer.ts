import type { GatewayObserver } from "@nodra/runtime";

export function createFlightRecorderObserver(endpoint="/api/gateway/events"):GatewayObserver {
  return async (event) => {
    const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(event)});
    if(!response.ok) throw new Error("Nodra flight recorder rejected gateway event.");
  };
}
