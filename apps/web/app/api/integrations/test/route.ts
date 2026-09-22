import {NextResponse} from "next/server";
import {getWorkspaceContext} from "../../../../lib/persistence";
import {createAdminClient} from "../../../../lib/supabase/admin";

const RECENT_WINDOW_MS=5*60*1000;
function isRecent(value:unknown,now:number){
 if(typeof value!=="string")return false;
 const timestamp=Date.parse(value);
 return Number.isFinite(timestamp)&&timestamp<=now+30_000&&now-timestamp<=RECENT_WINDOW_MS;
}

export async function POST(request:Request){
 const ctx=await getWorkspaceContext();if(!ctx)return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"invalid_request"},{status:400})}
 if(typeof body?.agentId!=="string"||body.agentId.length>128)return NextResponse.json({error:"agent_id_required"},{status:400});
 const {data:agent}=await ctx.supabase.from("agents").select("id,external_id,name,status,authority_scope").eq("workspace_id",ctx.workspaceId).eq("external_id",body.agentId).maybeSingle();
 if(!agent)return NextResponse.json({error:"unknown_agent"},{status:404});
 const {data:credential}=await createAdminClient().from("integration_credentials").select("id,last_used_at,status").eq("workspace_id",ctx.workspaceId).eq("agent_id",agent.id).eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle();
 const {data:event}=await ctx.supabase.from("security_events").select("id,occurred_at,decision,event_type").eq("workspace_id",ctx.workspaceId).eq("agent_id",agent.id).in("event_type",["gateway-authorization","gateway-tool-request"]).order("occurred_at",{ascending:false}).limit(1).maybeSingle();
 const now=Date.now();
 const credentialUsed=isRecent(credential?.last_used_at,now);
 const runtimeEvidence=isRecent(event?.occurred_at,now);
 const authorityConfigured=Array.isArray(agent.authority_scope)?agent.authority_scope.length>0:Boolean(agent.authority_scope&&Object.keys(agent.authority_scope).length);
 const connected=Boolean(credential)&&credentialUsed&&runtimeEvidence&&authorityConfigured&&agent.status==="healthy";
 return NextResponse.json({connected,checks:{activeCredential:Boolean(credential),credentialUsed,runtimeEvidence,authorityConfigured,agentHealthy:agent.status==="healthy"},agent,lastEvent:event??null,message:connected?"Signed protected runtime verified in the last five minutes.":"Protection is not active until a credential use and runtime evidence are both seen within the last five minutes, authority is configured, and the agent is healthy."});
}
