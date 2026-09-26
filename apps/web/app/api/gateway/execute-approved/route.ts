import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { hashIntegrationSecret } from "../../../../lib/integration-credentials";
import { GATEWAY_SIGNATURE_MAX_AGE_SECONDS, verifyCredentialRequest } from "../../../../lib/gateway-signing";

const hash=(v:string)=>createHash("sha256").update(v).digest("hex");

export async function POST(request:Request){
  const raw=await request.text();

  if(Buffer.byteLength(raw,"utf8")>32768){
    return NextResponse.json({error:"approval_execution_request_too_large"},{status:413});
  }

  let body:any;
  try{body=JSON.parse(raw)}catch{
    return NextResponse.json({error:"invalid_approval_execution_request"},{status:400});
  }

  if(
    typeof body?.agentId!=="string"||
    typeof body?.resourceId!=="string"||
    typeof body?.action!=="string"||
    typeof body?.authorizationEventId!=="string"||
    typeof body?.executionToken!=="string"||
    body.executionToken.length>256
  ){
    return NextResponse.json({error:"invalid_approval_execution_request"},{status:400});
  }

  const credential=request.headers.get("x-nodra-credential");
  if(!credential){
    return NextResponse.json({error:"credential_missing"},{status:401});
  }

  const verified=verifyCredentialRequest(
    raw,
    {
      timestamp:request.headers.get("x-nodra-timestamp"),
      nonce:request.headers.get("x-nodra-nonce"),
      signature:request.headers.get("x-nodra-signature")
    },
    credential
  );

  if(!verified.valid){
    return NextResponse.json({error:verified.reason},{status:401});
  }

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if(!url||!key){
    return NextResponse.json({error:"integration_auth_not_configured"},{status:503});
  }

  const supabase=createClient<any>(url,key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
  });

  const {data,error}=await supabase.rpc("execute_approved_integration_action",{
    p_secret_hash:hashIntegrationSecret(credential),
    p_external_agent_id:body.agentId,
    p_nonce:verified.nonce,
    p_request_timestamp:new Date(verified.timestamp*1000).toISOString(),
    p_expires_at:new Date((verified.timestamp+GATEWAY_SIGNATURE_MAX_AGE_SECONDS)*1000).toISOString(),
    p_authorization_event_id:body.authorizationEventId,
    p_execution_token_hash:hash(body.executionToken),
    p_resource_external_id:body.resourceId,
    p_action:body.action
  });

  if(error){
    const message=String(error.message||"");

    if(message.includes("invalid_credential")){
      return NextResponse.json({error:"invalid_credential"},{status:401});
    }
    if(message.includes("agent_not_healthy")){
      return NextResponse.json({error:"agent_not_healthy"},{status:403});
    }
    if(message.includes("gateway_request_replayed")){
      return NextResponse.json({error:"gateway_request_replayed"},{status:409});
    }
    if(message.includes("approval_authorization_mismatch")){
      return NextResponse.json({error:"approval_authorization_mismatch"},{status:403});
    }
    if(message.includes("approval_token_invalid_expired_or_consumed")){
      return NextResponse.json({error:"approval_token_invalid_expired_or_consumed"},{status:403});
    }

    return NextResponse.json({error:"approval_execution_unavailable"},{status:503});
  }

  const row=Array.isArray(data)?data[0]:data;

  return NextResponse.json({
    decision:"allow",
    reason:"human_approval_consumed",
    authorizationEventId:row?.authorization_event_id??body.authorizationEventId,
    executionEventId:row?.execution_event_id??null,
    agentId:row?.agent_external_id??body.agentId,
    resourceId:body.resourceId,
    action:body.action
  });
}
