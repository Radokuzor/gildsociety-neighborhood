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

type Step = "name" | "address" | "done";

const inputCls =
  "w-full text-xl font-semibold text-gs-dark bg-transparent border-0 border-b-2 border-gs-border pb-2 focus:outline-none focus:border-gs-red placeholder:text-gs-light placeholder:font-normal transition-colors duration-200";

export default function OnboardingOverlay({
  onDismiss,
  onComplete,
  defaultNeighborhoodId,
  defaultNeighborhoodName,
}: Props) {
  const supabase = createClient();

  const [step, setStep] = useState<Step>("name");
  const [direction, setDirection] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get neighborhood list for potential override (optional — we default to detected hood)
  const [neighborhoods, setNeighborhoods] = useState<
    Array<{ id: string; name: string; city: string; state: string }>
  >([]);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState(defaultNeighborhoodId);

  useEffect(() => {
    supabase
      .from("neighborhoods")
      .select("id, name, city, state")
      .eq("active", true)
      .then(({ data }) => setNeighborhoods(data ?? []));
  }, [supabase]);

  function go(next: Step, dir: number) {
    setDirection(dir);
    setError(null);
    setStep(next);
  }

  async function handleSave() {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Session expired. Please try the link again.");
        setLoading(false);
        return;
      }

      await supabase.from("subscribers").upsert(
        [
          {
            user_id: user.id,
            neighborhood_id: selectedNeighborhoodId,
            first_name: firstName.trim() || null,
            address: address.trim() || null,
          },
        ],
        { onConflict: "user_id" }
      );

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

          {/* X close button */}
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
          <div className="px-6 pb-8 pt-2 min-h-[280px] flex flex-col">
            <AnimatePresence mode="wait" custom={direction}>
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
                      Almost there — just 2 quick things
                    </p>
                    <h2 className="text-2xl font-black text-gs-dark mb-6">
                      What should we call you?
                    </h2>
                    <input
                      autoFocus
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && firstName.trim()) go("address", 1);
                      }}
                      placeholder="First name"
                      className={inputCls}
                      maxLength={50}
                    />
                  </div>

                  <div className="mt-auto pt-6">
                    <button
                      onClick={() => go("address", 1)}
                      disabled={!firstName.trim()}
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
                    <p className="text-gs-medium text-sm mb-6">
                      We&apos;ll confirm your neighborhood is{" "}
                      <span className="font-semibold text-gs-dark">{defaultNeighborhoodName}</span>.
                    </p>
                    <input
                      autoFocus
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="123 Oak Lane, Austin TX 78660"
                      className={inputCls}
                      autoComplete="street-address"
                    />

                    {/* Optional neighborhood override */}
                    {neighborhoods.length > 1 && (
                      <div className="mt-6">
                        <label className="text-xs font-semibold text-gs-medium uppercase tracking-wider mb-2 block">
                          Confirm your neighborhood
                        </label>
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
                      disabled={loading}
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
