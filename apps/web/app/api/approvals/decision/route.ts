import {createHash,randomBytes} from "node:crypto";
import {NextResponse} from "next/server";
import {getWorkspaceContext} from "../../../../lib/persistence";

const hash=(v:string)=>createHash("sha256").update(v).digest("hex");

export async function POST(request:Request){
 const ctx=await getWorkspaceContext();
 if(!ctx)return NextResponse.json({error:"authentication_or_workspace_required"},{status:401});
 if(!["owner","admin","analyst"].includes(ctx.role))return NextResponse.json({error:"insufficient_role"},{status:403});

 let body:any;
 try{body=await request.json()}catch{return NextResponse.json({error:"invalid_approval_decision"},{status:400})}

 if(
   typeof body?.eventId!=="string"||
   !["approved","denied"].includes(body?.decision)||
   typeof body?.reason!=="string"||
   body.reason.trim().length<3||
   body.reason.length>500
 ){
   return NextResponse.json({error:"invalid_approval_decision"},{status:400});
 }

 const executionToken=body.decision==="approved"?randomBytes(32).toString("base64url"):null;
 const executionTokenExpiresAt=executionToken?new Date(Date.now()+5*60*1000).toISOString():null;

 const {data,error}=await ctx.supabase.rpc("decide_approval",{
   p_event_id:body.eventId,
   p_decision:body.decision,
   p_reason:body.reason.trim(),
   p_execution_token_hash:executionToken?hash(executionToken):undefined,
   p_execution_token_expires_at:executionTokenExpiresAt??undefined
 });

 if(error){
   const message=String(error.message||"");
   if(message.includes("approval_event_not_found"))return NextResponse.json({error:"approval_event_not_found"},{status:404});
   if(message.includes("insufficient_role"))return NextResponse.json({error:"insufficient_role"},{status:403});
   if(message.includes("duplicate key")||error.code==="23505")return NextResponse.json({error:"approval_already_decided"},{status:409});
   return NextResponse.json({error:"approval_decision_failed"},{status:500});
 }

 const decision=Array.isArray(data)?data[0]:data;

 return NextResponse.json({
   decision,
   executionToken,
   warning:executionToken
     ?"This approval token expires in five minutes and is shown once. Pass it to the protected runtime's executeApproved call."
     :null
 });
}
