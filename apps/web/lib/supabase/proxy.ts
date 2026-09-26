import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../database.types";

const protectedPrefixes = [
  "/network",
  "/agents",
  "/incidents",
  "/activity",
  "/policies",
  "/credentials",
  "/containment",
  "/recovery",
  "/reports",
  "/settings",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Public surfaces (including the homepage) must remain renderable in a
  // fresh local checkout where Supabase environment variables are absent.
  // Protected application routes still fail closed.
  if (!url || !publishableKey) {
    if (isProtected) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.search = "";
      redirectUrl.searchParams.set("auth", "configuration-required");
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();

  if (isProtected && !data?.claims) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("auth", "required");
    return NextResponse.redirect(redirectUrl);
  }

  if (isProtected && data?.claims) {
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", data.claims.sub)
      .order("workspace_id")
      .limit(1)
      .maybeSingle();

    let timeoutMinutes = 30;
    if (membership?.workspace_id) {
      const { data: settings } = await supabase
        .from("workspace_settings")
        .select("session_timeout_minutes,require_mfa,ip_restrictions,ip_allowlist")
        .eq("workspace_id", membership.workspace_id)
        .maybeSingle();
      timeoutMinutes = Number(settings?.session_timeout_minutes ?? 30);

      if (settings?.require_mfa && String(data.claims.aal ?? "aal1") !== "aal2") {
        const mfaUrl = request.nextUrl.clone();
        mfaUrl.pathname = "/auth/mfa";
        mfaUrl.search = "";
        mfaUrl.searchParams.set("next", pathname + request.nextUrl.search);
        return NextResponse.redirect(mfaUrl);
      }

      if (settings?.ip_restrictions) {
        const forwarded =
          request.headers.get("x-vercel-forwarded-for") ??
          request.headers.get("x-forwarded-for") ??
          "";
        const clientIp = forwarded.split(",")[0]?.trim() ?? "";
        const { data: ipAllowed, error: ipError } = await supabase.rpc("workspace_ip_allowed", {
          p_workspace_id: membership.workspace_id,
          p_ip: clientIp,
        } as any);

        if (ipError || ipAllowed !== true) {
          return new NextResponse("Access denied by Nodra workspace IP policy.", {
            status: 403,
            headers: { "cache-control": "no-store" },
          });
        }
      }
    }

    const now = Date.now();
    const lastActive = Number(request.cookies.get("nodra-last-active")?.value ?? "0");

    if (lastActive > 0 && now - lastActive > timeoutMinutes * 60_000) {
      const signoutUrl = request.nextUrl.clone();
      signoutUrl.pathname = "/auth/signout";
      signoutUrl.search = "";
      signoutUrl.searchParams.set("reason", "session-timeout");
      return NextResponse.redirect(signoutUrl);
    }

    response.cookies.set("nodra-last-active", String(now), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.max(timeoutMinutes * 60, 300),
    });
  }

  return response;
}
