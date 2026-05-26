"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// useSearchParams() must be inside a Suspense boundary during build.
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner message="Signing you in…" />}>
      <CallbackHandler />
    </Suspense>
  );
}

function CallbackHandler() {
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
        // Full navigation so the server re-renders the home page with the new session.
        window.location.href = next.startsWith("/") ? next : "/";
      }
    });
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
