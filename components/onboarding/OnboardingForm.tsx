"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Neighborhood =
  Database["public"]["Tables"]["neighborhoods"]["Row"];

// ─── Step definitions ──────────────────────────────────────────────────────────
const TOTAL_STEPS = 5; // excludes welcome (0) and done (6)

// ─── Animation variants ────────────────────────────────────────────────────────
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
    transition: { duration: 0.25, ease: "easeIn" as const },
  }),
};

// ─── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ step }: { step: number }) {
  if (step === 0 || step > TOTAL_STEPS) return null;
  const pct = Math.round((step / TOTAL_STEPS) * 100);
  return (
    <div className="fixed top-0 left-0 right-0 h-0.5 bg-gs-border z-50">
      <motion.div
        className="h-full bg-gs-red"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </div>
  );
}

// ─── Back button ───────────────────────────────────────────────────────────────
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-4 left-4 p-2 rounded-full hover:bg-gs-surface tap-none transition-colors"
      aria-label="Go back"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#484848" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
}

// ─── Shared input style ────────────────────────────────────────────────────────
const inputCls =
  "w-full text-xl sm:text-2xl font-semibold text-gs-dark bg-transparent border-0 border-b-2 border-gs-border pb-2 focus:outline-none focus:border-gs-red placeholder:text-gs-light placeholder:font-normal transition-colors duration-200";

// ─── Main component ────────────────────────────────────────────────────────────
export default function OnboardingForm() {
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");
  const [email, setEmail] = useState("");
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [matchedNeighborhood, setMatchedNeighborhood] = useState<Neighborhood | null>(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<Neighborhood | null>(null);
  const [showOverride, setShowOverride] = useState(false);

  // Fetch all neighborhoods for override dropdown
  useEffect(() => {
    supabase
      .from("neighborhoods")
      .select("*")
      .eq("active", true)
      .then(({ data }) => setNeighborhoods(data ?? []));
  }, [supabase]);

  // Auto-match neighborhood by zip
  useEffect(() => {
    const trimmed = zip.replace(/\D/g, "").slice(0, 5);
    if (trimmed.length !== 5) return;

    // Two-step: get neighborhood_id from zip map, then fetch neighborhood
    supabase
      .from("zip_neighborhood_map")
      .select("neighborhood_id")
      .eq("zip_code", trimmed)
      .single()
      .then(async ({ data: mapRow }) => {
        if (!mapRow?.neighborhood_id) {
          setMatchedNeighborhood(null);
          return;
        }
        const { data: n } = await supabase
          .from("neighborhoods")
          .select("*")
          .eq("id", mapRow.neighborhood_id)
          .single();
        if (n) {
          setMatchedNeighborhood(n);
          setSelectedNeighborhood(n);
        } else {
          setMatchedNeighborhood(null);
        }
      });
  }, [zip, supabase]);

  function go(nextStep: number) {
    setDirection(nextStep > step ? 1 : -1);
    setError(null);
    setStep(nextStep);
  }

  // ─── Sign-up handler ─────────────────────────────────────────────────────────
  async function handleSubmit() {
    setLoading(true);
    setError(null);

    try {
      const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/${selectedNeighborhood?.slug ?? ""}`;

      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            first_name: firstName,
            address,
            neighborhood_id: selectedNeighborhood?.id ?? null,
          },
        },
      });

      if (authError) throw authError;

      go(6); // Done screen
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ─── Step validation ──────────────────────────────────────────────────────────
  function canAdvance() {
    if (step === 1) return firstName.trim().length > 0;
    if (step === 2) return address.trim().length > 0 && zip.trim().length === 5;
    if (step === 3) return selectedNeighborhood !== null;
    if (step === 4) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return true;
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && canAdvance() && step < 5) {
      e.preventDefault();
      go(step + 1);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen-safe flex flex-col bg-white">
      <ProgressBar step={step} />

      {step > 0 && step <= TOTAL_STEPS && (
        <BackButton onClick={() => go(step - 1)} />
      )}

      <AnimatePresence mode="wait" custom={direction}>
        {/* ── Step 0: Welcome ─────────────────────────────────────────────────── */}
        {step === 0 && (
          <motion.div
            key="welcome"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col items-center justify-center flex-1 px-6 py-16 text-center"
          >
            {/* Logo */}
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gs-red mb-4">
                <span className="text-white text-2xl font-black">G</span>
              </div>
              <p className="text-xs tracking-[0.2em] uppercase text-gs-medium font-semibold">Gild Society</p>
            </div>

            <h1 className="text-4xl sm:text-5xl font-black text-gs-dark leading-tight mb-4">
              Keeping the<br />
              <span className="text-gs-red">community</span><br />
              safe together.
            </h1>

            <p className="text-gs-medium text-lg max-w-xs mb-12 leading-relaxed">
              Your neighborhood newsletter — real news, real neighbors, delivered weekly.
            </p>

            <button
              onClick={() => go(1)}
              className="w-full max-w-xs bg-gs-red text-white font-bold text-lg py-4 px-8 rounded-2xl hover:bg-gs-red-dark active:scale-95 transition-all tap-none shadow-lg shadow-gs-red/20"
            >
              Get started
            </button>

            <p className="mt-6 text-gs-medium text-sm">
              Free forever. No spam. Unsubscribe anytime.
            </p>
          </motion.div>
        )}

        {/* ── Step 1: Name ─────────────────────────────────────────────────────── */}
        {step === 1 && (
          <motion.div
            key="name"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col flex-1 px-6 pt-20 pb-8"
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-gs-red uppercase tracking-widest mb-6">Step 1 of {TOTAL_STEPS}</p>
              <h2 className="text-3xl sm:text-4xl font-black text-gs-dark mb-10 leading-snug">
                What should<br />we call you?
              </h2>
              <input
                autoFocus
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="First name"
                className={inputCls}
                maxLength={50}
              />
            </div>

            <NextButton disabled={!canAdvance()} onClick={() => go(2)} />
          </motion.div>
        )}

        {/* ── Step 2: Address ───────────────────────────────────────────────────── */}
        {step === 2 && (
          <motion.div
            key="address"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col flex-1 px-6 pt-20 pb-8"
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-gs-red uppercase tracking-widest mb-6">Step 2 of {TOTAL_STEPS}</p>
              <h2 className="text-3xl sm:text-4xl font-black text-gs-dark mb-2 leading-snug">
                Let&apos;s confirm you&apos;re<br />part of the community.
              </h2>
              <p className="text-gs-medium mb-10">What&apos;s your address?</p>

              <div className="space-y-8">
                <div>
                  <label className="text-xs font-semibold text-gs-medium uppercase tracking-wider mb-2 block">Street address</label>
                  <input
                    autoFocus
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="123 Oak Lane"
                    className={inputCls}
                    autoComplete="street-address"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gs-medium uppercase tracking-wider mb-2 block">ZIP code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={zip}
                    onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                    onKeyDown={handleKeyDown}
                    placeholder="78660"
                    className={inputCls}
                    maxLength={5}
                    autoComplete="postal-code"
                  />
                </div>
              </div>
            </div>

            <NextButton disabled={!canAdvance()} onClick={() => go(3)} />
          </motion.div>
        )}

        {/* ── Step 3: Neighborhood confirm ──────────────────────────────────────── */}
        {step === 3 && (
          <motion.div
            key="neighborhood"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col flex-1 px-6 pt-20 pb-8"
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-gs-red uppercase tracking-widest mb-6">Step 3 of {TOTAL_STEPS}</p>

              {matchedNeighborhood ? (
                <>
                  <h2 className="text-3xl sm:text-4xl font-black text-gs-dark mb-2 leading-snug">
                    Looks like you&apos;re in
                  </h2>
                  <h2 className="text-3xl sm:text-4xl font-black text-gs-red mb-8 leading-snug">
                    {matchedNeighborhood.name}.
                  </h2>
                  <p className="text-gs-medium mb-8">
                    {matchedNeighborhood.city}, {matchedNeighborhood.state} — is that right?
                  </p>

                  {/* Confirm card */}
                  <button
                    onClick={() => {
                      setSelectedNeighborhood(matchedNeighborhood);
                      setShowOverride(false);
                    }}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all mb-4 ${
                      selectedNeighborhood?.id === matchedNeighborhood.id && !showOverride
                        ? "border-gs-red bg-accent"
                        : "border-gs-border hover:border-gs-red/40"
                    }`}
                  >
                    <p className="font-bold text-gs-dark">{matchedNeighborhood.name}</p>
                    <p className="text-gs-medium text-sm">{matchedNeighborhood.city}, {matchedNeighborhood.state}</p>
                  </button>

                  <button
                    onClick={() => setShowOverride(!showOverride)}
                    className="text-sm text-gs-medium underline underline-offset-2"
                  >
                    That&apos;s not right — let me choose
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-3xl sm:text-4xl font-black text-gs-dark mb-2 leading-snug">
                    Which neighborhood<br />are you in?
                  </h2>
                  <p className="text-gs-medium mb-8">We couldn&apos;t auto-detect yours. Pick from the list below.</p>
                </>
              )}

              {/* Override / full dropdown */}
              {(showOverride || !matchedNeighborhood) && (
                <div className="mt-4">
                  <label className="text-xs font-semibold text-gs-medium uppercase tracking-wider mb-2 block">Choose your neighborhood</label>
                  <select
                    value={selectedNeighborhood?.id ?? ""}
                    onChange={(e) => {
                      const n = neighborhoods.find((x) => x.id === e.target.value) ?? null;
                      setSelectedNeighborhood(n);
                    }}
                    className="w-full text-lg font-semibold text-gs-dark bg-white border-0 border-b-2 border-gs-border pb-2 focus:outline-none focus:border-gs-red appearance-none transition-colors"
                  >
                    <option value="">Select a neighborhood…</option>
                    {neighborhoods.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} — {n.city}, {n.state}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <NextButton disabled={!canAdvance()} onClick={() => go(4)} />
          </motion.div>
        )}

        {/* ── Step 4: Email ─────────────────────────────────────────────────────── */}
        {step === 4 && (
          <motion.div
            key="email"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col flex-1 px-6 pt-20 pb-8"
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-gs-red uppercase tracking-widest mb-6">Step 4 of {TOTAL_STEPS}</p>
              <h2 className="text-3xl sm:text-4xl font-black text-gs-dark mb-2 leading-snug">
                Where should<br />we send your<br />newsletter?
              </h2>
              <p className="text-gs-medium mb-10">We&apos;ll email you a magic link — no password needed.</p>
              <input
                autoFocus
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canAdvance()) {
                    e.preventDefault();
                    go(5);
                  }
                }}
                placeholder="you@example.com"
                className={inputCls}
                autoComplete="email"
              />
            </div>

            <NextButton disabled={!canAdvance()} onClick={() => go(5)} label="Almost there →" />
          </motion.div>
        )}

        {/* ── Step 5: Review & submit ───────────────────────────────────────────── */}
        {step === 5 && (
          <motion.div
            key="review"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col flex-1 px-6 pt-20 pb-8"
          >
            <div className="flex-1">
              <p className="text-sm font-semibold text-gs-red uppercase tracking-widest mb-6">Step 5 of {TOTAL_STEPS}</p>
              <h2 className="text-3xl sm:text-4xl font-black text-gs-dark mb-10 leading-snug">
                Ready, {firstName}?
              </h2>

              {/* Summary card */}
              <div className="rounded-3xl border border-gs-border bg-gs-surface p-6 space-y-4">
                <Row icon="🏠" label="Neighborhood" value={selectedNeighborhood?.name ?? "—"} />
                <Row icon="📍" label="Address" value={address || "—"} />
                <Row icon="✉️" label="Email" value={email} />
              </div>

              {error && (
                <p className="mt-4 text-sm text-destructive font-medium">{error}</p>
              )}
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-gs-red text-white font-bold text-lg py-4 px-8 rounded-2xl hover:bg-gs-red-dark active:scale-95 transition-all tap-none shadow-lg shadow-gs-red/20 disabled:opacity-60 disabled:pointer-events-none mt-6"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner /> Sending link…
                </span>
              ) : (
                "Send my magic link 🎉"
              )}
            </button>

            <p className="text-center text-xs text-gs-medium mt-4">
              By signing up you agree to receive weekly newsletters from Gild Society.
            </p>
          </motion.div>
        )}

        {/* ── Step 6: Done ─────────────────────────────────────────────────────── */}
        {step === 6 && (
          <motion.div
            key="done"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col items-center justify-center flex-1 px-6 py-16 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
              className="text-6xl mb-6"
            >
              📬
            </motion.div>
            <h2 className="text-4xl font-black text-gs-dark mb-4">Check your inbox!</h2>
            <p className="text-gs-medium text-lg max-w-xs leading-relaxed">
              We sent a magic link to <strong className="text-gs-dark">{email}</strong>. Click it to access your neighborhood page.
            </p>
            <p className="text-gs-light text-sm mt-8">Didn&apos;t get it? Check your spam folder.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function NextButton({
  disabled,
  onClick,
  label = "Continue →",
}: {
  disabled: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-gs-dark text-white font-bold text-lg py-4 px-8 rounded-2xl hover:bg-gs-dark/90 active:scale-95 transition-all tap-none disabled:opacity-30 disabled:pointer-events-none mt-6"
    >
      {label}
    </button>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-xs text-gs-medium font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-gs-dark font-semibold">{value}</p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
    </svg>
  );
}
