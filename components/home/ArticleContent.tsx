"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Database } from "@/types/database";

type Neighborhood = Database["public"]["Tables"]["neighborhoods"]["Row"];
type NewsletterIssue = Database["public"]["Tables"]["newsletter_issues"]["Row"];

/** New content schema — matches admin preview and email template */
interface NewsletterContent {
  // ── New format ──────────────────────────────────────────────────────────────
  opening?: string;
  local_news?: Array<{ headline: string; body: string }>;
  city_connection?: { headline: string; body: string } | null;
  neighborhood_checkin?: { question: string; options: string[] } | null;
  business_spotlight?: { name: string; description: string; location: string } | null;
  diy_tip?: { title: string; body: string } | null;
  fun_fact?: string;
  // ── Legacy format (kept for backward compat) ─────────────────────────────
  top_news?: Array<{ headline: string; summary: string; url?: string }>;
  person_of_week?: { name: string; blurb: string };
  community_pulse?: { type: "trivia" | "poll"; question: string; options: string[] };
}

interface Props {
  neighborhood: Neighborhood;
  issue: NewsletterIssue | null;
  isLoading: boolean;
  hasFullAccess: boolean;
  onPaywallReached: () => void;
}

export default function ArticleContent({
  neighborhood,
  issue,
  isLoading,
  hasFullAccess,
  onPaywallReached,
}: Props) {
  const paywallMarkerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const triggeredRef = useRef(false);

  // ── IntersectionObserver: fires when reader hits the 40% mark ────────────
  useEffect(() => {
    if (hasFullAccess) return;
    triggeredRef.current = false;

    const marker = paywallMarkerRef.current;
    if (!marker) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggeredRef.current) {
          triggeredRef.current = true;
          onPaywallReached();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -20% 0px" }
    );

    observerRef.current.observe(marker);
    return () => observerRef.current?.disconnect();
  }, [hasFullAccess, onPaywallReached, issue?.id]);

  if (isLoading) {
    return <ArticleSkeleton />;
  }

  if (!issue) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">📭</div>
        <h2 className="text-xl font-black text-gs-dark mb-2">
          Coming soon to {neighborhood.name}
        </h2>
        <p className="text-gs-medium">
          We&apos;re working on your first edition. Sign up to be notified when it drops.
        </p>
      </div>
    );
  }

  const content = (issue.content_json as NewsletterContent) ?? {};
  const isNewFormat = !!(content.local_news || content.opening);

  // ── Legacy format ──────────────────────────────────────────────────────────
  if (!isNewFormat) {
    return <LegacyArticleContent content={content} neighborhood={neighborhood} hasFullAccess={hasFullAccess} onPaywallReached={onPaywallReached} paywallMarkerRef={paywallMarkerRef} />;
  }

  // ── New format ─────────────────────────────────────────────────────────────
  return (
    <article className="max-w-2xl mx-auto px-4 py-6 pb-24">

      {/* ── ABOVE PAYWALL ──────────────────────────────────────────────────── */}

      {/* ── HOOK LINE — matches email opening ──────────────────────────────── */}
      {content.opening && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="font-serif italic text-gs-medium text-[15px] leading-relaxed mb-6 border-l-2 border-gs-red pl-3"
        >
          &ldquo;{content.opening}&rdquo;
        </motion.p>
      )}

      {/* Local News — always visible */}
      {content.local_news && content.local_news.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <div className="space-y-5">
            {content.local_news.map((item, i) => (
              <div key={i} className={i < (content.local_news?.length ?? 0) - 1 ? "pb-5 border-b border-gs-border" : ""}>
                <h2 className="font-black text-gs-dark text-lg leading-snug mb-2 font-serif">
                  {item.headline}
                </h2>
                <p className="text-gs-medium leading-relaxed text-sm">{item.body}</p>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ── PAYWALL MARKER ─────────────────────────────────────────────────── */}
      <div ref={paywallMarkerRef} aria-hidden="true" />

      {/* ── BELOW PAYWALL ──────────────────────────────────────────────────── */}
      <div
        className={`transition-all duration-300 ${!hasFullAccess ? "blur-sm pointer-events-none select-none" : ""}`}
        aria-hidden={!hasFullAccess}
      >
        {/* City connection */}
        {content.city_connection && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="bg-gs-surface rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gs-medium mb-3">
                In {neighborhood.city} This Week
              </p>
              <h3 className="font-bold text-gs-dark text-base leading-snug mb-2 font-serif">
                {content.city_connection.headline}
              </h3>
              <p className="text-gs-medium leading-relaxed text-sm">{content.city_connection.body}</p>
            </div>
          </motion.section>
        )}

        {/* Neighborhood Check-in */}
        {content.neighborhood_checkin && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8"
          >
            <div className="bg-gs-surface rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gs-medium mb-3">
                Neighborhood Check-in
              </p>
              <p className="font-semibold text-gs-dark mb-4 leading-snug">
                {content.neighborhood_checkin.question}
              </p>
              <div className="space-y-2">
                {content.neighborhood_checkin.options.map((opt, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-4 py-3 rounded-xl border-2 border-gs-border bg-white hover:border-gs-red hover:bg-accent text-gs-dark font-medium text-sm transition-all tap-none"
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gs-light mt-3">Results shared in next week&apos;s edition.</p>
            </div>
          </motion.section>
        )}

        {/* Nominate a Neighbor */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <NominateForm neighborhoodName={neighborhood.name} />
        </motion.section>

        {/* Business Spotlight */}
        {content.business_spotlight && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-8"
          >
            <div className="bg-gs-surface rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gs-medium mb-3">Business Spotlight</p>
              <p className="font-black text-gs-dark text-base mb-0.5">
                {content.business_spotlight.name}
              </p>
              {content.business_spotlight.location && (
                <p className="text-xs text-gs-light font-semibold uppercase tracking-wide mb-2">
                  {content.business_spotlight.location}
                </p>
              )}
              <p className="text-gs-medium text-sm leading-relaxed">
                {content.business_spotlight.description}
              </p>
            </div>
          </motion.section>
        )}

        {/* DIY Tip */}
        {content.diy_tip && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <div className="bg-gs-surface rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gs-medium mb-3">DIY Tip</p>
              <p className="font-black text-gs-dark mb-2">{content.diy_tip.title}</p>
              <p className="text-gs-medium text-sm leading-relaxed">{content.diy_tip.body}</p>
            </div>
          </motion.section>
        )}

        {/* Fun Fact */}
        {content.fun_fact && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mb-8"
          >
            <div className="bg-gs-surface border-l-4 border-gs-red rounded-r-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gs-medium mb-2">Fun Fact</p>
              <p className="text-gs-dark leading-relaxed italic text-sm">
                &ldquo;{content.fun_fact}&rdquo;
              </p>
            </div>
          </motion.section>
        )}
      </div>
    </article>
  );
}

// ── Legacy format renderer ─────────────────────────────────────────────────────

function LegacyArticleContent({
  content,
  neighborhood,
  hasFullAccess,
  onPaywallReached,
  paywallMarkerRef,
}: {
  content: NewsletterContent;
  neighborhood: { name: string };
  hasFullAccess: boolean;
  onPaywallReached: () => void;
  paywallMarkerRef: React.RefObject<HTMLDivElement | null>;
}) {
  // silence unused warning
  void onPaywallReached;
  return (
    <article className="max-w-2xl mx-auto px-4 py-6 pb-24">
      {content.top_news && content.top_news.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <div className="space-y-5">
            {content.top_news.map((item, i) => (
              <div key={i} className={i < (content.top_news?.length ?? 0) - 1 ? "pb-5 border-b border-gs-border" : ""}>
                <h2 className="font-black text-gs-dark text-lg leading-snug mb-1">
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-gs-red transition-colors">
                      {item.headline}
                    </a>
                  ) : item.headline}
                </h2>
                <p className="text-gs-medium leading-relaxed text-sm">{item.summary}</p>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      <div ref={paywallMarkerRef} aria-hidden="true" />

      <div
        className={`transition-all duration-300 ${!hasFullAccess ? "blur-sm pointer-events-none select-none" : ""}`}
        aria-hidden={!hasFullAccess}
      >
        {content.person_of_week && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
            <div className="flex items-start gap-4 bg-gs-surface rounded-2xl p-4">
              <div className="w-12 h-12 rounded-full bg-gs-red/10 flex items-center justify-center flex-shrink-0 text-xl">👤</div>
              <div>
                <p className="font-black text-gs-dark text-lg">{content.person_of_week.name}</p>
                <p className="text-gs-medium text-sm leading-relaxed mt-1">{content.person_of_week.blurb}</p>
              </div>
            </div>
          </motion.section>
        )}
        {content.community_pulse && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
            <div className="bg-gs-surface rounded-2xl p-4">
              <p className="font-semibold text-gs-dark mb-3">{content.community_pulse.question}</p>
              <div className="space-y-2">
                {content.community_pulse.options.map((opt, i) => (
                  <button key={i} className="w-full text-left px-4 py-3 rounded-xl border-2 border-gs-border bg-white hover:border-gs-red hover:bg-accent text-gs-dark font-medium text-sm transition-all tap-none">
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </motion.section>
        )}
        {content.fun_fact && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
            <p className="text-gs-dark leading-relaxed bg-gs-surface rounded-2xl p-4 italic">{content.fun_fact}</p>
          </motion.section>
        )}
        {content.diy_tip && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-8">
            <div className="bg-gs-surface rounded-2xl p-4">
              <p className="font-black text-gs-dark mb-2">{content.diy_tip.title}</p>
              <p className="text-gs-medium text-sm leading-relaxed">{content.diy_tip.body}</p>
            </div>
          </motion.section>
        )}
        <NominateForm neighborhoodName={neighborhood.name} />
      </div>
    </article>
  );
}

// ── Nominate form ──────────────────────────────────────────────────────────────

function NominateForm({ neighborhoodName }: { neighborhoodName: string }) {
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() && !reason.trim()) return;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-2xl bg-gs-red p-6 text-center">
        <p className="text-2xl mb-2">🙌</p>
        <p className="font-black text-white text-base">Thanks for the nomination!</p>
        <p className="text-white/80 text-sm mt-1">We&apos;ll look into it for the next issue.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gs-red p-6">
      <p className="font-black text-white text-base mb-1.5">Know a neighbor making a difference?</p>
      <p className="text-white/88 text-sm mb-5 leading-relaxed">
        Every week we spotlight one person who makes {neighborhoodName} a better place. Drop their name — it takes 30 seconds.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Their name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border-0 bg-white px-4 py-2.5 text-sm text-gs-dark placeholder:text-gs-medium focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
        />
        <textarea
          placeholder="Why do they deserve a shoutout?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full rounded-xl border-0 bg-white px-4 py-2.5 text-sm text-gs-dark placeholder:text-gs-medium focus:outline-none focus:ring-2 focus:ring-white/50 transition-all resize-none"
        />
        <button
          type="submit"
          disabled={!name.trim() && !reason.trim()}
          className="w-full bg-white text-gs-red font-black text-sm py-2.5 rounded-xl hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Submit nomination
        </button>
      </form>
    </div>
  );
}

// ── Article skeleton ───────────────────────────────────────────────────────────

function ArticleSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-pulse">
      <div className="h-4 bg-gs-border rounded-full w-24 mb-4" />
      <div className="h-8 bg-gs-border rounded-full w-3/4 mb-3" />
      <div className="h-4 bg-gs-border rounded-full w-1/2 mb-8" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="mb-6">
          <div className="h-5 bg-gs-border rounded-full w-2/3 mb-2" />
          <div className="h-4 bg-gs-border rounded-full w-full mb-1" />
          <div className="h-4 bg-gs-border rounded-full w-5/6" />
        </div>
      ))}
    </div>
  );
}
