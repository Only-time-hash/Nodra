"use client";

import type { ReactNode } from "react";
import { createClient } from "../lib/supabase/client";

export function GitHubAuthButton({ className="button", children="Continue with GitHub" }: { className?: string; children?: ReactNode }) {
  async function signIn() {
    const supabase=createClient();
    const redirectTo=`${window.location.origin}/auth/callback?next=/onboarding`;
    const { error }=await supabase.auth.signInWithOAuth({provider:"github",options:{redirectTo}});
    if(error) window.location.assign("/?auth=error");
  }
  return <button type="button" className={className} onClick={signIn}>{children}</button>;
}
