/**
 * GET /auth/callback
 *
 * Server-side PKCE callback — exchanges the Supabase auth code for a session.
 *
 * The PKCE code verifier is stored in the `pkce_verifiers` DB table (keyed by
 * `sid`), so it's available regardless of which browser opened this URL.
 * Cookies are written directly onto the redirect response so the browser
 * receives them even on a 302.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const sid  = searchParams.get("sid");   // PKCE verifier lookup key
  const next = searchParams.get("next") ?? "/";
  const dest = next.startsWith("/") ? `${origin}${next}` : origin;

  if (!code || !sid) {
    return NextResponse.redirect(`${origin}/?auth=error`);
  }

  // ── 1. Retrieve and delete the verifier from DB ─────────────────────────────
  const service = createServiceClient();

  const { data: row, error: fetchErr } = await service
    .from("pkce_verifiers")
    .select("code_verifier, expires_at")
    .eq("id", sid)
    .single();

  if (fetchErr || !row) {
    console.error("[auth/callback] verifier not found:", fetchErr?.message);
    return NextResponse.redirect(`${origin}/?auth=error`);
  }

  // Delete immediately — verifiers are single-use
  await service.from("pkce_verifiers").delete().eq("id", sid);

  // Check TTL
  if (new Date(row.expires_at) < new Date()) {
    console.error("[auth/callback] verifier expired");
    return NextResponse.redirect(`${origin}/?auth=error`);
  }

  // ── 2. Exchange code + verifier for tokens via Supabase REST ────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const tokenRes = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=pkce`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": anonKey,
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        auth_code: code,
        code_verifier: row.code_verifier,
      }),
    }
  );

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("[auth/callback] token exchange failed:", err);
    return NextResponse.redirect(`${origin}/?auth=error`);
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  // ── 3. Set session cookies on the redirect response ─────────────────────────
  const response = NextResponse.redirect(dest);

  const supabase = createServerClient(
    supabaseUrl,
    anonKey,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.setSession({
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
  });

  // ── 4. Capture email in subscribers table immediately ───────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email) {
    await service
      .from("subscribers")
      .upsert(
        [{ user_id: user.id, email: user.email }],
        { onConflict: "user_id", ignoreDuplicates: true }
      );
  }

  return response;
}
