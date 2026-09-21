import { NextResponse } from "next/server";
import { getWorkspaceContext } from "../../../../lib/persistence";

function validId(value:unknown){return typeof value==="string"&&/^[a-zA-Z0-9_-]{2,64}$/.test(value)}
export async function GET(){
 const ctx=await getWorkspaceContext();if(!ctx)return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 const {data,error}=await ctx.supabase.from("agents").select("id,external_id,name,kind,status,authority_scope").eq("workspace_id",ctx.workspaceId).order("name");
 if(error)return NextResponse.json({error:"agent_list_failed"},{status:500});
 return NextResponse.json({agents:data??[]});
}
export async function POST(request:Request){
 const ctx=await getWorkspaceContext();if(!ctx)return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 if(!["owner","admin"].includes(ctx.role))return NextResponse.json({error:"insufficient_role"},{status:403});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"invalid_agent"},{status:400})}
 if(!validId(body?.externalId)||typeof body?.name!=="string"||body.name.trim().length<2||body.name.length>100)return NextResponse.json({error:"invalid_agent"},{status:400});
 const {data,error}=await ctx.supabase.from("agents").insert({workspace_id:ctx.workspaceId,external_id:body.externalId,name:body.name.trim(),kind:"customer",status:"healthy",authority_scope:Array.isArray(body.authorityScope)?body.authorityScope:[]}).select("id,external_id,name,status,authority_scope").single();
 if(error)return NextResponse.json({error:error.code==="23505"?"agent_id_already_exists":"agent_registration_failed"},{status:error.code==="23505"?409:500});
 return NextResponse.json({agent:data},{status:201});
}

export async function PATCH(request:Request){
 const ctx=await getWorkspaceContext();if(!ctx)return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 if(!["owner","admin"].includes(ctx.role))return NextResponse.json({error:"insufficient_role"},{status:403});
 let body:any;try{body=await request.json()}catch{return NextResponse.json({error:"invalid_agent_update"},{status:400})}
 if(!validId(body?.externalId)||!Array.isArray(body?.authorityScope)||body.authorityScope.length>64)return NextResponse.json({error:"invalid_authority_scope"},{status:400});
 const scope:string[]=[...new Set<string>(body.authorityScope.filter((v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.length<=128))];
 if(scope.length!==body.authorityScope.length)return NextResponse.json({error:"invalid_authority_scope"},{status:400});
 const {data,error}=await ctx.supabase.from("agents").update({authority_scope:scope}).eq("workspace_id",ctx.workspaceId).eq("external_id",body.externalId).select("id,external_id,name,status,authority_scope").maybeSingle();
 if(error||!data)return NextResponse.json({error:"agent_update_failed"},{status:error?500:404});
 return NextResponse.json({agent:data});
}
