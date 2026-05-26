"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

interface Props {
  onDismiss: () => void;
  onComplete: () => void;
  defaultNeighborhoodId: string;
  defaultNeighborhoodName: string;
}

type Step = "name" | "address" | "neighborhood" | "done";

const inputCls =
  "w-full text-xl font-semibold text-gs-dark bg-transparent border-0 border-b-2 border-gs-border pb-2 focus:outline-none focus:border-gs-red placeholder:text-gs-light placeholder:font-normal transition-colors duration-200";

const labelCls = "text-xs font-semibold text-gs-medium uppercase tracking-wider mb-2 block";

export default function OnboardingOverlay({
  onDismiss,
  onComplete,
  defaultNeighborhoodId,
  defaultNeighborhoodName,
}: Props) {
  const supabase = createClient();

  const [step, setStep] = useState<Step>("name");
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Name fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Address fields (structured)
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");

  // Neighborhood
  const [neighborhoods, setNeighborhoods] = useState<
    Array<{ id: string; name: string; city: string; state: string }>
  >([]);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState(defaultNeighborhoodId);
  const [zipMatched, setZipMatched] = useState(false);

  // Load all neighborhoods for the dropdown
  useEffect(() => {
    supabase
      .from("neighborhoods")
      .select("id, name, city, state")
      .eq("active", true)
      .then(({ data }) => setNeighborhoods(data ?? []));
  }, [supabase]);

  // Auto-match neighborhood when ZIP reaches 5 digits
  useEffect(() => {
    const trimmed = zip.replace(/\D/g, "").slice(0, 5);
    if (trimmed.length !== 5) {
      setZipMatched(false);
      return;
    }

    supabase
      .from("zip_neighborhood_map")
      .select("neighborhood_id")
      .eq("zip_code", trimmed)
      .single()
      .then(async ({ data: mapRow }) => {
        if (!mapRow?.neighborhood_id) {
          setZipMatched(false);
          return;
        }
        const { data: n } = await supabase
          .from("neighborhoods")
          .select("id, name, city, state")
          .eq("id", mapRow.neighborhood_id)
          .single();
        if (n) {
          setSelectedNeighborhoodId(n.id);
          setZipMatched(true);
        } else {
          setZipMatched(false);
        }
      });
  }, [zip, supabase]);

  function go(next: Step, dir: number) {
    setDirection(dir);
    setError(null);
    setStep(next);
  }

  async function handleSave() {
    setLoading(true);
    setError(null);

    try {
      // Combine structured address into one string for storage
      const addressParts = [street.trim(), city.trim(), state.trim(), zip.trim()].filter(Boolean);
      const fullAddress = addressParts.join(", ");

      // Save via server-side API route (uses service role — bypasses RLS,
      // gracefully handles missing last_name column if migration hasn't run)
      const res = await fetch("/api/subscriber/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          neighborhoodId: selectedNeighborhoodId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          address: fullAddress,
        }),
      });

      const data = await res.json() as { ok?: boolean; error?: string };

      if (!res.ok) {
        if (res.status === 401) {
          setError("Session expired. Please click the magic link again.");
        } else {
          setError(data.error ?? "Something went wrong saving your info.");
        }
        return;
      }

      go("done", 1);
      setTimeout(onComplete, 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.3, ease: "easeOut" as const } },
    exit: (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0, transition: { duration: 0.2, ease: "easeIn" as const } }),
  };

  // Step-level validation
  const nameValid = firstName.trim().length > 0;
  const addressValid = street.trim().length > 0 && city.trim().length > 0 && state.trim().length > 0 && zip.trim().length === 5;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      />

      {/* Panel — slides up from bottom on mobile, centered on desktop */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
        className="fixed inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center z-50 pointer-events-none"
      >
        <div className="pointer-events-auto w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">

          {/* Drag handle (mobile) */}
          <div className="flex justify-center pt-3 sm:hidden">
            <div className="w-10 h-1 bg-gs-border rounded-full" />
          </div>

          {/* Header bar */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gs-red flex items-center justify-center">
                <span className="text-white text-xs font-black">G</span>
              </div>
              <span className="text-sm font-black text-gs-dark">Gild Society</span>
            </div>
            <button
              onClick={onDismiss}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gs-surface hover:bg-gs-border transition-colors tap-none"
              aria-label="Skip and continue reading"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#767676" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content area */}
          <div className="px-6 pb-8 pt-2 min-h-[320px] flex flex-col">
            <AnimatePresence mode="wait" custom={direction}>

              {/* ── Step: Name ─────────────────────────────────────────────── */}
              {step === "name" && (
                <motion.div
                  key="name"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="flex flex-col flex-1"
                >
                  <div className="mb-2">
                    <p className="text-xs text-gs-red font-bold uppercase tracking-widest mb-3">
                      Almost there — a few quick things
                    </p>
                    <h2 className="text-2xl font-black text-gs-dark mb-6">
                      What&apos;s your name?
                    </h2>
                    <div className="space-y-5">
                      <div>
                        <label className={labelCls}>First name</label>
                        <input
                          autoFocus
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && firstName.trim()) {
                              const el = document.getElementById("overlay-last-name");
                              el?.focus();
                            }
                          }}
                          placeholder="Jane"
                          className={inputCls}
                          maxLength={50}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Last name</label>
                        <input
                          id="overlay-last-name"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && nameValid) go("address", 1);
                          }}
                          placeholder="Smith"
                          className={inputCls}
                          maxLength={50}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-6">
                    <button
                      onClick={() => go("address", 1)}
                      disabled={!nameValid}
                      className="w-full bg-gs-dark text-white font-bold py-3.5 rounded-2xl disabled:opacity-30 disabled:pointer-events-none hover:bg-gs-dark/90 active:scale-95 transition-all tap-none"
                    >
                      Continue →
                    </button>
                    <button
                      onClick={onDismiss}
                      className="w-full mt-2 text-xs text-gs-medium text-center tap-none"
                    >
                      Skip and read the article
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Step: Address ──────────────────────────────────────────── */}
              {step === "address" && (
                <motion.div
                  key="address"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="flex flex-col flex-1"
                >
                  <div className="mb-2">
                    <button
                      onClick={() => go("name", -1)}
                      className="text-xs text-gs-medium mb-4 tap-none flex items-center gap-1"
                    >
                      ← Back
                    </button>
                    <h2 className="text-2xl font-black text-gs-dark mb-2">
                      What&apos;s your address?
                    </h2>
                    <p className="text-gs-medium text-sm mb-5">
                      We&apos;ll use your ZIP to confirm your neighborhood.
                    </p>
                    <div className="space-y-4">
                      <div>
                        <label className={labelCls}>Street address</label>
                        <input
                          autoFocus
                          type="text"
                          value={street}
                          onChange={(e) => setStreet(e.target.value)}
                          placeholder="123 Oak Lane"
                          className={inputCls}
                          autoComplete="address-line1"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelCls}>City</label>
                          <input
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="Austin"
                            className={inputCls}
                            autoComplete="address-level2"
                          />
                        </div>
                        <div>
                          <label className={labelCls}>State</label>
                          <input
                            type="text"
                            value={state}
                            onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                            placeholder="TX"
                            className={inputCls}
                            maxLength={2}
                            autoComplete="address-level1"
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>ZIP code</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={zip}
                          onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                          placeholder="78660"
                          className={inputCls}
                          maxLength={5}
                          autoComplete="postal-code"
                        />
                        {zip.length === 5 && (
                          <p className={`text-xs mt-1 ${zipMatched ? "text-green-600" : "text-gs-medium"}`}>
                            {zipMatched ? "✓ Neighborhood detected" : "ZIP not found — you'll confirm your neighborhood next"}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-6">
                    <button
                      onClick={() => go("neighborhood", 1)}
                      disabled={!addressValid}
                      className="w-full bg-gs-dark text-white font-bold py-3.5 rounded-2xl disabled:opacity-30 disabled:pointer-events-none hover:bg-gs-dark/90 active:scale-95 transition-all tap-none"
                    >
                      Continue →
                    </button>
                    <button
                      onClick={onDismiss}
                      className="w-full mt-2 text-xs text-gs-medium text-center tap-none"
                    >
                      Skip and read the article
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Step: Neighborhood confirm ─────────────────────────────── */}
              {step === "neighborhood" && (
                <motion.div
                  key="neighborhood"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="flex flex-col flex-1"
                >
                  <div className="mb-2">
                    <button
                      onClick={() => go("address", -1)}
                      className="text-xs text-gs-medium mb-4 tap-none flex items-center gap-1"
                    >
                      ← Back
                    </button>
                    <h2 className="text-2xl font-black text-gs-dark mb-2">
                      Confirm your neighborhood
                    </h2>
                    <p className="text-gs-medium text-sm mb-5">
                      {zipMatched
                        ? "We detected this from your ZIP — does it look right?"
                        : "We couldn't auto-detect your neighborhood. Please select it below."}
                    </p>

                    {neighborhoods.length > 0 && (
                      <div>
                        <label className={labelCls}>Neighborhood</label>
                        <select
                          value={selectedNeighborhoodId}
                          onChange={(e) => setSelectedNeighborhoodId(e.target.value)}
                          className="w-full text-base font-semibold text-gs-dark bg-white border-0 border-b-2 border-gs-border pb-2 focus:outline-none focus:border-gs-red appearance-none transition-colors"
                        >
                          {neighborhoods.map((n) => (
                            <option key={n.id} value={n.id}>
                              {n.name} — {n.city}, {n.state}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {error && (
                      <p className="text-sm text-destructive mt-3">{error}</p>
                    )}
                  </div>

                  <div className="mt-auto pt-6">
                    <button
                      onClick={handleSave}
                      disabled={loading || !selectedNeighborhoodId}
                      className="w-full bg-gs-red text-white font-bold py-3.5 rounded-2xl disabled:opacity-40 disabled:pointer-events-none hover:bg-gs-red-dark active:scale-95 transition-all tap-none shadow-lg shadow-gs-red/20"
                    >
                      {loading ? "Saving…" : "Done — read the full article 🎉"}
                    </button>
                    <button
                      onClick={onDismiss}
                      className="w-full mt-2 text-xs text-gs-medium text-center tap-none"
                    >
                      Skip and read the article
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Step: Done ─────────────────────────────────────────────── */}
              {step === "done" && (
                <motion.div
                  key="done"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="flex flex-col items-center justify-center flex-1 text-center py-6"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="text-5xl mb-4"
                  >
                    🎉
                  </motion.div>
                  <h2 className="text-2xl font-black text-gs-dark mb-2">
                    You&apos;re all set, {firstName}!
                  </h2>
                  <p className="text-gs-medium text-sm">
                    Welcome to the {defaultNeighborhoodName} community.
                    <br />Taking you back to the article…
                  </p>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </>
  );
}
