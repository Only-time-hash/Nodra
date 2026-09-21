import {createClient} from "@supabase/supabase-js";
import {hashIntegrationSecret} from "./integration-credentials";
import {verifyCredentialRequest} from "./gateway-signing";

export async function authenticateIntegrationRequest(request:Request,rawBody:string,externalAgentId:string){
 const credential=request.headers.get("x-nodra-credential");
 if(!credential)return {ok:false as const,status:401,error:"credential_missing"};
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return {ok:false as const,status:503,error:"integration_auth_not_configured"};
 const admin=createClient<any>(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await admin.from("integration_credentials").select("id,workspace_id,agent_id,status,agents!inner(id,external_id,status,authority_scope)").eq("secret_hash",hashIntegrationSecret(credential)).eq("status","active").maybeSingle();
 const agent=(data as any)?.agents;
 if(error||!data||!agent||agent.external_id!==externalAgentId)return {ok:false as const,status:401,error:"invalid_credential"};
 const verified=verifyCredentialRequest(rawBody,{timestamp:request.headers.get("x-nodra-timestamp"),nonce:request.headers.get("x-nodra-nonce"),signature:request.headers.get("x-nodra-signature")},credential);
 if(!verified.valid)return {ok:false as const,status:401,error:verified.reason};
 await admin.from("integration_credentials").update({last_used_at:new Date().toISOString()}).eq("id",data.id);
 return {ok:true as const,admin,workspaceId:data.workspace_id as string,agentId:data.agent_id as string,agent,credentialId:data.id as string,verified};
}
