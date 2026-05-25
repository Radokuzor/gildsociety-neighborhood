"use client";

import { motion } from "framer-motion";
import type { Database } from "@/types/database";

type Neighborhood = Database["public"]["Tables"]["neighborhoods"]["Row"];
type Subscriber = Database["public"]["Tables"]["subscribers"]["Row"];
type NewsletterIssue = Database["public"]["Tables"]["newsletter_issues"]["Row"];

interface Props {
  neighborhood: Neighborhood;
  subscriber: Subscriber | null;
  latestIssue: NewsletterIssue | null;
  userEmail: string;
}

// ─── Content JSON shape (from Claude generation) ──────────────────────────────
interface NewsletterContent {
  top_news?: Array<{ headline: string; summary: string; url?: string }>;
  person_of_week?: { name: string; blurb: string };
  business_spotlight?: { name: string; description: string; why_this_week?: string };
  community_pulse?: { type: "trivia" | "poll"; question: string; options: string[] };
  fun_fact?: string;
  diy_tip?: { title: string; body: string };
}

export default function NeighborhoodPage({
  neighborhood,
  subscriber,
  latestIssue,
  userEmail,
}: Props) {
  const firstName = subscriber?.first_name ?? userEmail.split("@")[0];
  const content = (latestIssue?.content_json as NewsletterContent) ?? null;

  return (
    <div className="min-h-screen-safe bg-gs-surface">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gs-border sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gs-red flex items-center justify-center">
              <span className="text-white text-sm font-black">G</span>
            </div>
            <span className="font-black text-gs-dark text-sm">Gild Society</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-gs-surface text-gs-medium font-semibold px-3 py-1 rounded-full border border-gs-border">
              {neighborhood.name}
            </span>
          </div>
        </div>
      </header>

      {/* ── Hero greeting ───────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white border-b border-gs-border"
      >
        <div className="max-w-2xl mx-auto px-4 py-8">
          <p className="text-sm font-semibold text-gs-red uppercase tracking-widest mb-2">
            Welcome back
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-gs-dark leading-snug mb-2">
            Hey, {firstName} 👋
          </h1>
          <p className="text-gs-medium">
            Here&apos;s what&apos;s happening in{" "}
            <span className="font-semibold text-gs-dark">{neighborhood.name}</span>.
          </p>
        </div>
      </motion.section>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {latestIssue && content ? (
          <>
            {/* Issue header */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-3xl border border-gs-border p-5"
            >
              <p className="text-xs text-gs-medium font-semibold uppercase tracking-wider mb-1">
                Latest edition
              </p>
              <h2 className="text-xl font-black text-gs-dark">{latestIssue.subject}</h2>
              {latestIssue.sent_at && (
                <p className="text-xs text-gs-medium mt-1">
                  {new Date(latestIssue.sent_at).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
            </motion.div>

            {/* Top News */}
            {content.top_news && content.top_news.length > 0 && (
              <Section title="📰 Top News" delay={0.15}>
                <div className="space-y-4">
                  {content.top_news.map((item, i) => (
                    <div key={i} className="pb-4 border-b border-gs-border last:border-0 last:pb-0">
                      <h3 className="font-bold text-gs-dark leading-snug mb-1">
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-gs-red transition-colors">
                            {item.headline}
                          </a>
                        ) : item.headline}
                      </h3>
                      <p className="text-gs-medium text-sm leading-relaxed">{item.summary}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Person of the Week */}
            {content.person_of_week && (
              <Section title="⭐ Person of the Week" delay={0.2}>
                <div className="flex items-start gap-4">
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
              </Section>
            )}

            {/* Business Spotlight */}
            {content.business_spotlight && (
              <Section title="🏪 Local Business Spotlight" delay={0.25}>
                <div>
                  <p className="font-black text-gs-dark text-lg mb-1">{content.business_spotlight.name}</p>
                  <p className="text-gs-medium text-sm leading-relaxed">{content.business_spotlight.description}</p>
                  {content.business_spotlight.why_this_week && (
                    <p className="text-xs text-gs-red font-semibold mt-2 uppercase tracking-wide">
                      {content.business_spotlight.why_this_week}
                    </p>
                  )}
                </div>
              </Section>
            )}

            {/* Community Pulse */}
            {content.community_pulse && (
              <Section title={content.community_pulse.type === "trivia" ? "🧠 Neighborhood Trivia" : "🗳️ Community Pulse"} delay={0.3}>
                <PulseCard issueId={latestIssue.id} pulse={content.community_pulse} />
              </Section>
            )}

            {/* Fun Fact */}
            {content.fun_fact && (
              <Section title="💡 Fun Fact" delay={0.35}>
                <p className="text-gs-dark leading-relaxed">{content.fun_fact}</p>
              </Section>
            )}

            {/* DIY Tip */}
            {content.diy_tip && (
              <Section title="🔧 DIY & Home Tips" delay={0.4}>
                <p className="font-bold text-gs-dark mb-2">{content.diy_tip.title}</p>
                <p className="text-gs-medium text-sm leading-relaxed">{content.diy_tip.body}</p>
              </Section>
            )}
          </>
        ) : (
          /* Empty state — first subscriber, no issues sent yet */
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-3xl border border-gs-border p-8 text-center"
          >
            <div className="text-5xl mb-4">📬</div>
            <h2 className="text-xl font-black text-gs-dark mb-2">
              You&apos;re on the list!
            </h2>
            <p className="text-gs-medium leading-relaxed">
              Your first{" "}
              <span className="font-semibold text-gs-dark">{neighborhood.name}</span>{" "}
              newsletter is being prepared. You&apos;ll receive it at{" "}
              <span className="font-semibold text-gs-dark">{userEmail}</span>.
            </p>
            <div className="mt-6 p-4 bg-gs-surface rounded-2xl">
              <p className="text-sm font-semibold text-gs-dark mb-1">📣 Know a neighbor?</p>
              <p className="text-xs text-gs-medium">Share Gild Society with them so they don&apos;t miss out.</p>
              <ShareButton neighborhood={neighborhood} />
            </div>
          </motion.div>
        )}

        {/* ── Nominate a Neighbor ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-gs-red rounded-3xl p-5 text-white"
        >
          <p className="font-black text-lg mb-1">Know a neighbor making a difference?</p>
          <p className="text-white/80 text-sm mb-4">Nominate them for Person of the Week!</p>
          <a
            href={`/${neighborhood.slug}/nominate`}
            className="inline-block bg-white text-gs-red font-bold text-sm py-2 px-5 rounded-xl hover:bg-white/90 transition-colors"
          >
            Submit a nomination →
          </a>
        </motion.div>

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <footer className="py-6 text-center">
          <p className="text-xs text-gs-light">
            © {new Date().getFullYear()} Gild Society · {neighborhood.name} Edition
          </p>
          <p className="text-xs text-gs-light mt-1">
            Sent to {userEmail} ·{" "}
            <a href="/unsubscribe" className="underline hover:text-gs-medium">Unsubscribe</a>
          </p>
        </footer>
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  title,
  children,
  delay = 0,
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white rounded-3xl border border-gs-border p-5"
    >
      <p className="text-xs font-black uppercase tracking-wider text-gs-medium mb-4">{title}</p>
      {children}
    </motion.div>
  );
}

// ─── Community Pulse / Quiz card ──────────────────────────────────────────────
function PulseCard({
  issueId,
  pulse,
}: {
  issueId: string;
  pulse: NonNullable<NewsletterContent["community_pulse"]>;
}) {
  // We'll implement response submission in a follow-up
  // For now shows the question + options
  return (
    <div>
      <p className="font-semibold text-gs-dark mb-4">{pulse.question}</p>
      <div className="space-y-2">
        {pulse.options.map((opt, i) => (
          <button
            key={i}
            className="w-full text-left px-4 py-3 rounded-xl border-2 border-gs-border hover:border-gs-red hover:bg-accent text-gs-dark font-medium text-sm transition-all tap-none"
          >
            {opt}
          </button>
        ))}
      </div>
      <p className="text-xs text-gs-medium mt-3">Results visible after you vote.</p>
      {/* Suppress unused variable warning */}
      <span className="hidden">{issueId}</span>
    </div>
  );
}

// ─── Share button ─────────────────────────────────────────────────────────────
function ShareButton({ neighborhood }: { neighborhood: Neighborhood }) {
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/${neighborhood.slug}`;

  function share() {
    if (navigator.share) {
      navigator.share({
        title: `Join the ${neighborhood.name} newsletter`,
        text: `Get hyper-local news for ${neighborhood.name} with Gild Society!`,
        url,
      });
    } else {
      navigator.clipboard.writeText(url);
    }
  }

  return (
    <button
      onClick={share}
      className="mt-3 text-sm font-bold text-gs-red border border-gs-red rounded-xl px-4 py-2 hover:bg-gs-red hover:text-white transition-all tap-none"
    >
      Share with neighbors
    </button>
  );
}
