import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {hashIntegrationSecret} from "../../../../../lib/integration-credentials";

export async function POST(request:Request){
 const internal=request.headers.get("x-nodra-internal-secret");
 if(!process.env.NODRA_INTERNAL_GATEWAY_SECRET||internal!==process.env.NODRA_INTERNAL_GATEWAY_SECRET)return NextResponse.json({error:"unauthorized"},{status:401});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"invalid_request"},{status:400})}
 if(typeof body?.credential!=="string"||typeof body?.agentId!=="string")return NextResponse.json({error:"invalid_request"},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:"credential_verifier_not_configured"},{status:503});
 const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const hash=hashIntegrationSecret(body.credential);
 const {data,error}=await supabase.from("integration_credentials").select("id,workspace_id,agent_id,agents!inner(external_id)").eq("secret_hash",hash).eq("status","active").maybeSingle();
 const externalId=(data as any)?.agents?.external_id;
 if(error||!data||externalId!==body.agentId)return NextResponse.json({error:"invalid_credential"},{status:401});
 await supabase.from("integration_credentials").update({last_used_at:new Date().toISOString()}).eq("id",data.id);
 return NextResponse.json({valid:true,workspaceId:data.workspace_id,agentId:data.agent_id,externalId});
}
