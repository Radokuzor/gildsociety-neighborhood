"use client";

/**
 * Auth callback — handles both implicit flow (hash tokens) and PKCE (code param).
 *
 * Implicit flow: Supabase puts tokens in the URL hash → we parse them and call
 * setSession(). No stored code verifier needed, so this works even when the
 * email app opens the link in a different browser context on mobile.
 *
 * PKCE fallback: kept for any links sent before the implicit-flow change.
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner message="Signing you in…" />}>
      <CallbackHandler />
    </Suspense>
  );
}

function CallbackHandler() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const next = searchParams.get("next") ?? "/";
    const dest = next.startsWith("/") ? next : "/";
    const supabase = createClient();

    // ── Implicit flow: tokens in the URL hash ─────────────────────────────────
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ error }) => {
            if (error) {
              console.error("setSession error:", error.message);
              setMessage("Couldn't sign you in. Please try again.");
              setTimeout(() => { window.location.href = "/"; }, 2000);
            } else {
              // Full navigation so the server re-renders with the new session.
              window.location.href = dest;
            }
          });
        return;
      }
    }

    // ── PKCE flow: exchange the code param ────────────────────────────────────
    const code = searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error("exchangeCodeForSession error:", error.message);
          setMessage("Couldn't sign you in. Please try again.");
          setTimeout(() => { window.location.href = "/"; }, 2000);
        } else {
          window.location.href = dest;
        }
      });
      return;
    }

    // No token at all
    setMessage("No login token found — redirecting…");
    setTimeout(() => { window.location.href = "/"; }, 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Spinner message={message} />;
}

function Spinner({ message }: { message: string }) {
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
      <p style={{ margin: 0, fontSize: 15, color: "#767676", fontWeight: 500 }}>
        {message}
      </p>
    </div>
  );
}
