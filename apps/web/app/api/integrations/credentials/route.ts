import {NextResponse} from "next/server";
import {getWorkspaceContext} from "../../../../lib/persistence";
import {issueIntegrationSecret} from "../../../../lib/integration-credentials";\nimport {createAdminClient} from "../../../../lib/supabase/admin";

export async function POST(request:Request){
 const ctx=await getWorkspaceContext();if(!ctx)return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 if(!["owner","admin"].includes(ctx.role))return NextResponse.json({error:"insufficient_role"},{status:403});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"invalid_request"},{status:400})}
 if(typeof body?.agentId!=="string")return NextResponse.json({error:"agent_id_required"},{status:400});
 const {data:agent}=await ctx.supabase.from("agents").select("id,external_id").eq("workspace_id",ctx.workspaceId).eq("external_id",body.agentId).maybeSingle();
 if(!agent)return NextResponse.json({error:"unknown_agent"},{status:404});
 const issued=issueIntegrationSecret();
 const {data,error}=await createAdminClient().from("integration_credentials").insert({workspace_id:ctx.workspaceId,agent_id:agent.id,label:String(body.label||"Default integration").slice(0,80),secret_hash:issued.hash,secret_prefix:issued.prefix,created_by:ctx.userId}).select("id,label,secret_prefix,status,created_at").single();
 if(error)return NextResponse.json({error:"credential_issue_failed"},{status:500});
 return NextResponse.json({credential:data,secret:issued.secret,warning:"Store this secret now. Nodra will not return it again."},{status:201});
}
export async function DELETE(request:Request){
 const ctx=await getWorkspaceContext();if(!ctx)return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 if(!["owner","admin"].includes(ctx.role))return NextResponse.json({error:"insufficient_role"},{status:403});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"invalid_request"},{status:400})}
 const {data,error}=await createAdminClient().from("integration_credentials").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("workspace_id",ctx.workspaceId).eq("id",body?.credentialId).eq("status","active").select("id,status,revoked_at").maybeSingle();
 if(error||!data)return NextResponse.json({error:"credential_not_found"},{status:404});
 return NextResponse.json({credential:data});
}

export async function PUT(request:Request){
 const ctx=await getWorkspaceContext();if(!ctx)return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 if(!["owner","admin"].includes(ctx.role))return NextResponse.json({error:"insufficient_role"},{status:403});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"invalid_request"},{status:400})}
 if(typeof body?.credentialId!=="string")return NextResponse.json({error:"credential_id_required"},{status:400});
 const {data:old}=await createAdminClient().from("integration_credentials").select("id,agent_id,label,status").eq("workspace_id",ctx.workspaceId).eq("id",body.credentialId).eq("status","active").maybeSingle();
 if(!old)return NextResponse.json({error:"credential_not_found"},{status:404});
 const issued=issueIntegrationSecret();
 const {data:next,error}=await createAdminClient().from("integration_credentials").insert({workspace_id:ctx.workspaceId,agent_id:old.agent_id,label:old.label,secret_hash:issued.hash,secret_prefix:issued.prefix,created_by:ctx.userId,rotated_from:old.id}).select("id,label,secret_prefix,status,created_at").single();
 if(error||!next)return NextResponse.json({error:"credential_rotation_failed"},{status:500});
 const {error:revokeError}=await createAdminClient().from("integration_credentials").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("workspace_id",ctx.workspaceId).eq("id",old.id).eq("status","active");
 if(revokeError){await createAdminClient().from("integration_credentials").delete().eq("workspace_id",ctx.workspaceId).eq("id",next.id);return NextResponse.json({error:"credential_rotation_failed"},{status:500})}
 return NextResponse.json({credential:next,secret:issued.secret,warning:"Store this rotated secret now. Nodra will not return it again."});
}
