"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { Database } from "@/types/database";

type Neighborhood = Database["public"]["Tables"]["neighborhoods"]["Row"];
type NewsletterIssue = Database["public"]["Tables"]["newsletter_issues"]["Row"];

interface NewsletterContent {
  top_news?: Array<{ headline: string; summary: string; url?: string }>;
  person_of_week?: { name: string; blurb: string };
  business_spotlight?: { name: string; description: string; why_this_week?: string };
  community_pulse?: { type: "trivia" | "poll"; question: string; options: string[] };
  fun_fact?: string;
  diy_tip?: { title: string; body: string };
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
        // When the marker scrolls INTO view from below → paywall
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
  const sentDate = issue.sent_at
    ? new Date(issue.sent_at).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <article className="max-w-2xl mx-auto px-4 py-6 pb-24">
      {/* Article meta */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs bg-gs-red/10 text-gs-red font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
            {neighborhood.name}
          </span>
          {sentDate && (
            <span className="text-xs text-gs-medium">{sentDate}</span>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gs-dark leading-snug">
          {issue.subject}
        </h1>
        {issue.preview_text && (
          <p className="text-gs-medium mt-2 leading-relaxed">{issue.preview_text}</p>
        )}
        <div className="mt-4 h-px bg-gs-border" />
      </motion.div>

      {/* ── ABOVE PAYWALL (always visible) ─────────────────────────────────── */}

      {/* Top News — always shown */}
      {content.top_news && content.top_news.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <SectionLabel>📰 Top News</SectionLabel>
          <div className="space-y-5">
            {content.top_news.map((item, i) => (
              <div key={i} className={i < content.top_news!.length - 1 ? "pb-5 border-b border-gs-border" : ""}>
                <h2 className="font-black text-gs-dark text-lg leading-snug mb-1">
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-gs-red transition-colors"
                    >
                      {item.headline}
                    </a>
                  ) : (
                    item.headline
                  )}
                </h2>
                <p className="text-gs-medium leading-relaxed text-sm">{item.summary}</p>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ── PAYWALL MARKER (at ~40% of content) ───────────────────────────── */}
      {/* Invisible sentinel — when it enters viewport, paywall fires */}
      <div ref={paywallMarkerRef} aria-hidden="true" />

      {/* ── BELOW PAYWALL (blurred when no access) ─────────────────────────── */}
      <div
        className={`transition-all duration-300 ${
          !hasFullAccess
            ? "blur-sm pointer-events-none select-none"
            : ""
        }`}
        aria-hidden={!hasFullAccess}
      >
        {/* Person of the Week */}
        {content.person_of_week && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <SectionLabel>⭐ Person of the Week</SectionLabel>
            <div className="flex items-start gap-4 bg-gs-surface rounded-2xl p-4">
              <div className="w-12 h-12 rounded-full bg-gs-red/10 flex items-center justify-center flex-shrink-0 text-xl">
                👤
              </div>
              <div>
                <p className="font-black text-gs-dark text-lg">{content.person_of_week.name}</p>
                <p className="text-gs-medium text-sm leading-relaxed mt-1">
                  {content.person_of_week.blurb}
                </p>
              </div>
            </div>
          </motion.section>
        )}

        {/* Business Spotlight */}
        {content.business_spotlight && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8"
          >
            <SectionLabel>🏪 Local Business Spotlight</SectionLabel>
            <div className="bg-gs-surface rounded-2xl p-4">
              <p className="font-black text-gs-dark text-lg mb-1">
                {content.business_spotlight.name}
              </p>
              <p className="text-gs-medium text-sm leading-relaxed">
                {content.business_spotlight.description}
              </p>
              {content.business_spotlight.why_this_week && (
                <p className="text-xs text-gs-red font-bold uppercase tracking-wide mt-2">
                  {content.business_spotlight.why_this_week}
                </p>
              )}
            </div>
          </motion.section>
        )}

        {/* Community Pulse */}
        {content.community_pulse && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <SectionLabel>
              {content.community_pulse.type === "trivia"
                ? "🧠 Neighborhood Trivia"
                : "🗳️ Community Pulse"}
            </SectionLabel>
            <div className="bg-gs-surface rounded-2xl p-4">
              <p className="font-semibold text-gs-dark mb-3">
                {content.community_pulse.question}
              </p>
              <div className="space-y-2">
                {content.community_pulse.options.map((opt, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-4 py-3 rounded-xl border-2 border-gs-border bg-white hover:border-gs-red hover:bg-accent text-gs-dark font-medium text-sm transition-all tap-none"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* Fun Fact */}
        {content.fun_fact && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-8"
          >
            <SectionLabel>💡 Fun Fact</SectionLabel>
            <p className="text-gs-dark leading-relaxed bg-gs-surface rounded-2xl p-4">
              {content.fun_fact}
            </p>
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
            <SectionLabel>🔧 DIY & Home Tips</SectionLabel>
            <div className="bg-gs-surface rounded-2xl p-4">
              <p className="font-black text-gs-dark mb-2">{content.diy_tip.title}</p>
              <p className="text-gs-medium text-sm leading-relaxed">{content.diy_tip.body}</p>
            </div>
          </motion.section>
        )}

        {/* Nominate section */}
        <div className="bg-gs-red rounded-3xl p-5 text-white mt-4">
          <p className="font-black text-lg mb-1">Know someone making a difference?</p>
          <p className="text-white/80 text-sm mb-4">
            Nominate them for Person of the Week in {neighborhood.name}.
          </p>
          <a
            href={`/${neighborhood.slug}/nominate`}
            className="inline-block bg-white text-gs-red font-bold text-sm py-2 px-5 rounded-xl hover:bg-white/90 transition-colors"
          >
            Submit a nomination →
          </a>
        </div>
      </div>
    </article>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-black uppercase tracking-wider text-gs-medium mb-4">
      {children}
    </p>
  );
}

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
