"use client";

import type { ReactNode } from "react";
import { createClient } from "../lib/supabase/client";

type AuthIntent = "signup" | "signin";

export function GitHubAuthButton({
  className = "button",
  children = "Continue with GitHub",
  intent = "signup",
}: {
  className?: string;
  children?: ReactNode;
  intent?: AuthIntent;
}) {
  async function signIn() {
    const supabase = createClient();
    const next = `/auth/continue?intent=${intent}`;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo },
    });

    if (error) {
      window.location.assign("/?auth=error");
    }
  }

  return (
    <button type="button" className={className} onClick={signIn}>
      {children}
    </button>
  );
}
