import { createProtectedResearchAgent } from "../../../../lib/protected-agent-example";
import { createFlightRecorderObserver } from "../../../../lib/gateway-observer";
import { NextResponse } from "next/server";

export async function POST(request:Request){
 const body=await request.json().catch(()=>null);
 if(!body?.resourceId||!body?.action) return NextResponse.json({error:"resourceId_and_action_required"},{status:400});
 const agent=createProtectedResearchAgent(createFlightRecorderObserver());
 try {
   const result=await agent.act(String(body.resourceId),String(body.action),body.input??{});
   return NextResponse.json(result,{status:result.event.decision==="deny"?403:result.event.decision==="require-approval"?202:200});
 } catch {
   return NextResponse.json({error:"protected_agent_execution_failed"},{status:500});
 }
}
