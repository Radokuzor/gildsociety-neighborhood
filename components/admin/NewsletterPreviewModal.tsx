"use client";

import type { AdminIssue } from "@/app/admin/page";

interface Props {
  issue: AdminIssue;
  onClose: () => void;
}

export default function NewsletterPreviewModal({ issue, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl mb-8">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gs-border">
          <div>
            <p className="font-black text-gs-dark">{issue.subject}</p>
            <p className="text-xs text-gs-medium">
              {issue.neighborhoods?.name} ·{" "}
              {new Date(issue.created_at).toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gs-surface hover:bg-gs-border transition-colors tap-none"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#767676" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content preview */}
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          <ContentPreview content={issue} />
        </div>
      </div>
    </div>
  );
}

function ContentPreview({ content }: { content: AdminIssue }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = content as any;
  const json = c.content_json as Record<string, unknown> | null;

  if (!json) {
    return (
      <p className="text-gs-medium text-sm">
        No content preview available. The HTML body was generated.
      </p>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = json as any;

  return (
    <div className="space-y-5 text-sm">
      {/* Top news */}
      {Array.isArray(data.top_news) && data.top_news.length > 0 && (
        <Section title="📰 Top News">
          {data.top_news.map((item: {headline:string;summary:string;url?:string;local_angle?:string}, i: number) => (
            <div key={i} className="py-3 border-b border-gs-border last:border-0">
              <p className="font-bold text-gs-dark">{item.headline}</p>
              <p className="text-gs-medium mt-1">{item.summary}</p>
              {item.local_angle && (
                <p className="text-xs text-gs-red font-semibold mt-1">{item.local_angle}</p>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Person of week */}
      {data.person_of_week && (
        <Section title="⭐ Person of the Week">
          <p className="font-bold text-gs-dark">{data.person_of_week.name}</p>
          <p className="text-gs-medium mt-1">{data.person_of_week.blurb}</p>
        </Section>
      )}

      {/* Business */}
      {data.business_spotlight && (
        <Section title="🏪 Business Spotlight">
          <p className="font-bold text-gs-dark">{data.business_spotlight.name}</p>
          <p className="text-gs-medium mt-1">{data.business_spotlight.description}</p>
        </Section>
      )}

      {/* Community pulse */}
      {data.community_pulse && (
        <Section title={data.community_pulse.type === "trivia" ? "🧠 Trivia" : "🗳️ Community Pulse"}>
          <p className="font-semibold text-gs-dark">{data.community_pulse.question}</p>
          <ul className="mt-2 space-y-1">
            {(data.community_pulse.options as string[]).map((opt: string, i: number) => (
              <li key={i} className="text-gs-medium">• {opt}</li>
            ))}
          </ul>
          {data.community_pulse.correct_answer && (
            <p className="text-xs text-gs-red font-semibold mt-2">
              ✓ Answer: {data.community_pulse.correct_answer}
            </p>
          )}
        </Section>
      )}

      {/* Fun fact */}
      {data.fun_fact && (
        <Section title="💡 Fun Fact">
          <p className="text-gs-dark italic">"{data.fun_fact}"</p>
        </Section>
      )}

      {/* DIY */}
      {data.diy_tip && (
        <Section title="🔧 DIY Tip">
          <p className="font-bold text-gs-dark">{data.diy_tip.title}</p>
          <p className="text-gs-medium mt-1">{data.diy_tip.body}</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gs-surface rounded-2xl p-4">
      <p className="text-xs font-black uppercase tracking-wider text-gs-medium mb-3">{title}</p>
      {children}
    </div>
  );
}
