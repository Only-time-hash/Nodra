import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const target = new URL("/auth", request.url);
  target.searchParams.set("intent", "signin");
  if (request.nextUrl.searchParams.get("reason") === "session-timeout") {
    target.searchParams.set("reason", "session-timeout");
  }

  const response = NextResponse.redirect(target);
  response.cookies.delete("nodra-last-active");
  return response;
}
