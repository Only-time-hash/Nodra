import {NextResponse} from "next/server";
export async function GET(){return NextResponse.json({ok:true,service:"nodra-web",timestamp:new Date().toISOString()},{headers:{"cache-control":"no-store"}})}
