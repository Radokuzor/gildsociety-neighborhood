"use client";

/**
 * Magic-link auth callback — client-side.
 *
 * WHY CLIENT-SIDE:
 * The PKCE code verifier is stored in the browser that called signInWithOtp().
 * On mobile, email apps often open links in an in-app browser that does NOT share
 * cookies with the main browser. A server-side Route Handler reads verifier cookies
 * from the incoming request, so if the in-app browser doesn't have them it fails
 * silently and the user lands on the home page still logged-out.
 *
 * Running the exchange client-side means the Supabase JS library uses its own
 * in-memory / localStorage storage in whatever browser context the page loads in
 * — no cross-context cookie dependency.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";

    if (!code) {
      setMessage("No login code found — redirecting…");
      setTimeout(() => router.replace("/"), 1500);
      return;
    }

    const supabase = createClient();

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        console.error("Auth callback error:", error.message);
        setMessage("Couldn't sign you in. Please try again.");
        setTimeout(() => router.replace("/"), 2000);
      } else {
        // Session is now active in the browser. Do a full navigation (not
        // router.push) so the server re-renders the home page with the session.
        window.location.href = next.startsWith("/") ? next : "/";
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        background: "#F7F7F7",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        gap: "16px",
      }}
    >
      {/* Spinner */}
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid #EBEBEB",
          borderTop: "3px solid #FF5A5F",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <p
        style={{
          margin: 0,
          fontSize: 15,
          color: "#767676",
          fontWeight: 500,
        }}
      >
        {message}
      </p>
    </div>
  );
}
