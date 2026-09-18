import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/network";
  if (!next.startsWith("/")) next = "/network";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const host = process.env.NODE_ENV === "development" ? origin : forwardedHost ? `https://${forwardedHost}` : origin;
      return NextResponse.redirect(`${host}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/?auth=error`);
}
