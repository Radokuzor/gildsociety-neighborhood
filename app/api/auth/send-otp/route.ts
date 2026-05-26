/**
 * POST /api/auth/send-otp
 *
 * Server-side PKCE magic-link sender.
 *
 * WHY SERVER-SIDE:
 * @supabase/ssr stores the PKCE code verifier in the browser's cookies.
 * On mobile, email apps open magic links in a different browser context
 * (in-app browser / WebView) that doesn't share those cookies, so the
 * client-side verifier is gone by the time the callback runs.
 *
 * By generating the verifier here on the server and storing it in the DB,
 * the callback can look it up regardless of which browser hits it.
 * The lookup key (session ID) travels in the redirect URL itself.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  let body: { email?: string; redirectTo?: string; neighborhoodSlug?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, redirectTo, neighborhoodSlug } = body;
  if (!email || !redirectTo) {
    return NextResponse.json({ error: "email and redirectTo are required" }, { status: 400 });
  }

  // ── 1. Generate PKCE pair ───────────────────────────────────────────────────
  const { verifier, challenge } = await generatePKCE();

  // ── 2. Store verifier in DB (10-minute TTL) ─────────────────────────────────
  const service = createServiceClient();
  const { data: row, error: dbError } = await service
    .from("pkce_verifiers")
    .insert({ code_verifier: verifier })
    .select("id")
    .single();

  if (dbError || !row) {
    console.error("[send-otp] DB insert error:", dbError);
    return NextResponse.json({ error: "Failed to create auth session" }, { status: 500 });
  }

  // ── 3. Append session ID to redirect URL so the callback can find the verifier
  const callbackUrl = `${redirectTo}&sid=${row.id}`;

  // ── 4. Call Supabase auth API directly with our own code challenge ──────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const otpRes = await fetch(`${supabaseUrl}/auth/v1/otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": anonKey,
      "Authorization": `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      email,
      create_user: true,
      data: { neighborhood_slug: neighborhoodSlug ?? null },
      code_challenge: challenge,
      code_challenge_method: "s256",
      options: { email_redirect_to: callbackUrl },
    }),
  });

  if (!otpRes.ok) {
    const err = await otpRes.text();
    console.error("[send-otp] Supabase OTP error:", err);
    // Clean up the verifier row we created
    await service.from("pkce_verifiers").delete().eq("id", row.id);
    return NextResponse.json({ error: "Failed to send magic link" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  // Code verifier: 32 random bytes, base64url encoded (RFC 7636)
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64url(raw);

  // Code challenge: SHA-256 of verifier, base64url encoded
  const encoded = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  const challenge = base64url(new Uint8Array(hash));

  return { verifier, challenge };
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
