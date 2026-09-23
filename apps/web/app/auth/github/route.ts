import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/continue?intent=signin")}` },
  });
  if (error || !data.url) return NextResponse.redirect(`${origin}/?auth=github-error`);
  return NextResponse.redirect(data.url);
}
