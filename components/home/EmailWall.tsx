"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface Props {
  neighborhoodName: string;
  neighborhoodSlug: string;
  onEmailSubmit: (email: string) => void;
  onClose: () => void;
}

export default function EmailWall({
  neighborhoodName,
  neighborhoodSlug,
  onEmailSubmit,
  onClose,
}: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail) return;

    setLoading(true);
    setError(null);

    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/?n=${neighborhoodSlug}&show=onboarding`)}`;

      // Server-side PKCE: verifier is generated + stored in DB so the callback
      // can look it up regardless of which browser context opens the magic link.
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirectTo, neighborhoodSlug }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to send magic link");
      }

      setSent(true);
      onEmailSubmit(email);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-white/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed left-0 right-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center z-50 pointer-events-none"
      >
        <div className="pointer-events-auto w-full sm:w-auto sm:min-w-[400px] sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gs-border overflow-hidden mx-auto">

          {/* Handle bar (mobile) */}
          <div className="flex justify-center pt-3 pb-0 sm:hidden">
            <div className="w-10 h-1 bg-gs-border rounded-full" />
          </div>

          <div className="px-6 py-6 sm:p-8">
            {!sent ? (
              <>
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gs-red/10 mb-4">
                    <span className="text-3xl">🔓</span>
                  </div>
                  <h2 className="text-2xl font-black text-gs-dark leading-snug">
                    Keep reading the<br />
                    <span className="text-gs-red">{neighborhoodName}</span> edition
                  </h2>
                  <p className="text-gs-medium mt-2 text-sm leading-relaxed">
                    Enter your email to get free access — plus we&apos;ll send you this newsletter every week.
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    type="email"
                    inputMode="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoComplete="email"
                    className="w-full px-4 py-3.5 rounded-2xl border-2 border-gs-border text-gs-dark font-semibold text-base placeholder:text-gs-light focus:outline-none focus:border-gs-red transition-colors"
                  />

                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={!isValidEmail || loading}
                    className="w-full bg-gs-red text-white font-bold text-base py-4 rounded-2xl hover:bg-gs-red-dark active:scale-95 transition-all tap-none disabled:opacity-40 disabled:pointer-events-none shadow-lg shadow-gs-red/20"
                  >
                    {loading ? "Sending link…" : "Get full access →"}
                  </button>

                  <p className="text-center text-xs text-gs-medium">
                    We&apos;ll email you a magic link. No password. Unsubscribe anytime.
                  </p>
                </form>

                {/* Skip */}
                <div className="text-center mt-4">
                  <button
                    onClick={onClose}
                    className="text-xs text-gs-medium underline underline-offset-2 tap-none"
                  >
                    No thanks, I&apos;ll skip for now
                  </button>
                </div>
              </>
            ) : (
              /* Sent state */
              <div className="text-center py-4">
                <div className="text-5xl mb-4">📬</div>
                <h2 className="text-xl font-black text-gs-dark mb-2">Check your inbox!</h2>
                <p className="text-gs-medium text-sm leading-relaxed">
                  We sent a link to <strong className="text-gs-dark">{email}</strong>.
                  Click it to unlock the full article and get weekly updates.
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
