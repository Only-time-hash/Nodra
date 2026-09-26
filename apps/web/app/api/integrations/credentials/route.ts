import {NextResponse} from "next/server";
import {getWorkspaceContext} from "../../../../lib/persistence";
import {issueIntegrationSecret} from "../../../../lib/integration-credentials";

export async function GET(){
 const ctx=await getWorkspaceContext();if(!ctx)return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 const {data,error}=await (ctx.supabase as any).rpc("list_integration_credentials",{p_workspace_id:ctx.workspaceId});
 if(error)return NextResponse.json({error:"credential_list_failed",detail:String(error.message||"")},{status:500});
 return NextResponse.json({credentials:data??[]});
}

export async function POST(request:Request){
 const ctx=await getWorkspaceContext();if(!ctx)return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 if(!["owner","admin"].includes(ctx.role))return NextResponse.json({error:"insufficient_role"},{status:403});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"invalid_request"},{status:400})}
 if(typeof body?.agentId!=="string")return NextResponse.json({error:"agent_id_required"},{status:400});

 const issued=issueIntegrationSecret();

 const {data,error}=await (ctx.supabase as any).rpc("issue_integration_credential",{
   p_workspace_id:ctx.workspaceId,
   p_agent_external_id:body.agentId,
   p_label:String(body.label||"Default integration").slice(0,80),
   p_secret_hash:issued.hash,
   p_secret_prefix:issued.prefix
 });

 if(error){
   const message=String(error.message||"");
   if(message.includes("unknown_agent"))return NextResponse.json({error:"unknown_agent"},{status:404});
   if(message.includes("insufficient_role"))return NextResponse.json({error:"insufficient_role"},{status:403});
   if(message.includes("authentication_required")||message.includes("workspace_required"))return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
   return NextResponse.json({error:"credential_issue_failed"},{status:500});
 }

 const credential=Array.isArray(data)?data[0]:data;
 if(!credential)return NextResponse.json({error:"credential_issue_failed"},{status:500});

 return NextResponse.json({
   credential,
   secret:issued.secret,
   warning:"Store this secret now. Nodra will not return it again."
 },{status:201});
}

export async function DELETE(request:Request){
 const ctx=await getWorkspaceContext();if(!ctx)return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 if(!["owner","admin"].includes(ctx.role))return NextResponse.json({error:"insufficient_role"},{status:403});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"invalid_request"},{status:400})}
 if(typeof body?.credentialId!=="string")return NextResponse.json({error:"credential_id_required"},{status:400});
 const {data,error}=await (ctx.supabase as any).rpc("revoke_integration_credential",{p_workspace_id:ctx.workspaceId,p_credential_id:body.credentialId});
 if(error){
   const message=String(error.message||"");
   if(message.includes("credential_not_found"))return NextResponse.json({error:"credential_not_found"},{status:404});
   if(message.includes("insufficient_role"))return NextResponse.json({error:"insufficient_role"},{status:403});
   return NextResponse.json({error:"credential_revoke_failed"},{status:500});
 }
 return NextResponse.json({credential:Array.isArray(data)?data[0]:data});
}

export async function PUT(request:Request){
 const ctx=await getWorkspaceContext();if(!ctx)return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 if(!["owner","admin"].includes(ctx.role))return NextResponse.json({error:"insufficient_role"},{status:403});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"invalid_request"},{status:400})}
 if(typeof body?.credentialId!=="string")return NextResponse.json({error:"credential_id_required"},{status:400});

 const issued=issueIntegrationSecret();
 const {data,error}=await (ctx.supabase as any).rpc("rotate_integration_credential",{
   p_workspace_id:ctx.workspaceId,
   p_credential_id:body.credentialId,
   p_secret_hash:issued.hash,
   p_secret_prefix:issued.prefix
 });

 if(error){
   const message=String(error.message||"");
   if(message.includes("credential_not_found"))return NextResponse.json({error:"credential_not_found"},{status:404});
   if(message.includes("insufficient_role"))return NextResponse.json({error:"insufficient_role"},{status:403});
   return NextResponse.json({error:"credential_rotation_failed"},{status:500});
 }

 const credential=Array.isArray(data)?data[0]:data;
 if(!credential)return NextResponse.json({error:"credential_rotation_failed"},{status:500});

 return NextResponse.json({
   credential,
   secret:issued.secret,
   warning:"Store this rotated secret now. Nodra will not return it again."
 });
}
