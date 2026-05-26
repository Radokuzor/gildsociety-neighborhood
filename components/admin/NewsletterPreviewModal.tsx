"use client";

import { useRef, useState } from "react";
import type { AdminIssue } from "@/app/admin/page";
import type { NewsletterContent } from "@/lib/claude";

interface Props {
  issue: AdminIssue;
  onClose: () => void;
  /** Called after a successful save so the dashboard can update its local state */
  onSaved: (updated: AdminIssue) => void;
  /** Resolved neighborhood name — used in the Nominate card */
  neighborhoodName?: string;
}

export default function NewsletterPreviewModal({ issue, onClose, onSaved, neighborhoodName = "the neighborhood" }: Props) {
  const [subject, setSubject] = useState(issue.subject);
  const [previewText, setPreviewText] = useState(issue.preview_text ?? "");
  const [content, setContent] = useState<NewsletterContent>(
    (issue.content_json as NewsletterContent) ?? {}
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function updateContent(updater: (prev: NewsletterContent) => NewsletterContent) {
    setContent((prev) => updater(prev));
    setSaveState("idle");
  }

  async function handleSave() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/admin/update-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: issue.id, subject, previewText, content }),
      });
      if (res.ok) {
        setSaveState("saved");
        onSaved({ ...issue, subject, preview_text: previewText, content_json: content });
      } else {
        setSaveState("error");
      }
    } catch {
      setSaveState("error");
    }
  }

  const issueDate = new Date(issue.created_at).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl mb-8">

        {/* ── GS Email-style Header Card ─────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-3">
          <div className="bg-gs-surface border border-gs-border rounded-2xl px-5 py-4">
            {/* Top row: logo + neighborhood pill + close */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gs-red flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-black text-sm">G</span>
                </div>
                <span className="font-black text-gs-dark text-xs uppercase tracking-widest">Gild Society</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gs-medium font-semibold bg-white border border-gs-border px-2.5 py-1 rounded-full">
                  {neighborhoodName}
                </span>
                <button
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gs-border hover:bg-gs-border transition-colors tap-none"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#767676" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Date */}
            <p className="text-xs text-gs-light mb-2">{issueDate}</p>

            {/* Opening sentence — editable */}
            <EditableText
              value={content.opening ?? ""}
              onChange={(v) => updateContent((prev) => ({ ...prev, opening: v }))}
              className="text-sm text-gs-medium italic font-serif leading-relaxed"
              placeholder="Opening hook sentence…"
            />
          </div>
        </div>

        {/* ── Email metadata (subject + preview text) ────────────────────────── */}
        <div className="px-5 pb-3 border-b border-gs-border">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gs-light mb-1">Email subject</p>
              <EditableText
                value={subject}
                onChange={(v) => { setSubject(v); setSaveState("idle"); }}
                className="text-xs font-bold text-gs-dark"
                placeholder="Subject line…"
              />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gs-light mb-1">Inbox preview text</p>
              <EditableText
                value={previewText}
                onChange={(v) => { setPreviewText(v); setSaveState("idle"); }}
                className="text-xs text-gs-medium italic"
                placeholder="Preview text…"
              />
            </div>
          </div>
        </div>

        {/* ── Scrollable content — this is the source of truth ──────────────── */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3 text-sm">
          <ContentEditor
            content={content}
            onChange={updateContent}
            neighborhoodName={neighborhoodName}
          />
        </div>

        {/* ── Footer — save ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gs-border">
          <p className="text-xs text-gs-medium">
            {saveState === "saved"  && "✓ Saved"}
            {saveState === "error"  && "⚠ Save failed — try again"}
            {saveState === "idle"   && "Click any text to edit · × to delete a block"}
            {saveState === "saving" && "Saving…"}
          </p>
          <button
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="bg-gs-dark text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-gs-dark/90 disabled:opacity-50 transition-all"
          >
            {saveState === "saving" ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Editable plain-text (single line) ─────────────────────────────────────────

function EditableText({
  value,
  onChange,
  className = "",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={() => onChange(ref.current?.innerText.trim() ?? "")}
      data-placeholder={placeholder}
      className={`block outline-none rounded px-1 -mx-1 cursor-text
        hover:bg-black/5 focus:bg-black/[0.04] focus:ring-1 focus:ring-gs-red/30
        empty:before:content-[attr(data-placeholder)] empty:before:text-gs-medium/50
        transition-colors ${className}`}
    >
      {value}
    </span>
  );
}

// ── Editable multiline block ───────────────────────────────────────────────────

function EditableBlock({
  value,
  onChange,
  className = "",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={() => onChange(ref.current?.innerText.trim() ?? "")}
      data-placeholder={placeholder}
      className={`outline-none rounded px-1 -mx-1 cursor-text whitespace-pre-wrap
        hover:bg-black/5 focus:bg-black/[0.04] focus:ring-1 focus:ring-gs-red/30
        empty:before:content-[attr(data-placeholder)] empty:before:text-gs-medium/50
        transition-colors ${className}`}
    >
      {value}
    </div>
  );
}

// ── Delete button ──────────────────────────────────────────────────────────────

function DeleteBtn({ onClick, label = "Remove block" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gs-light hover:text-red-500 hover:bg-red-50 transition-colors tap-none"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

// ── Content editor ─────────────────────────────────────────────────────────────

function ContentEditor({
  content,
  onChange,
  neighborhoodName,
}: {
  content: NewsletterContent;
  onChange: (updater: (prev: NewsletterContent) => NewsletterContent) => void;
  neighborhoodName: string;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = content as any;
  const isNewFormat = !!data.opening || !!data.local_news;

  if (!isNewFormat) return <LegacyPreview data={data} />;

  function deleteNewsItem(index: number) {
    onChange((prev) => ({
      ...prev,
      local_news: prev.local_news.filter((_, i) => i !== index),
    }));
  }

  return (
    <>
      {/* Local news */}
      {content.local_news?.length > 0 && (
        <div className="bg-white border border-gs-border rounded-2xl p-4 space-y-4">
          {content.local_news.map((item, i) => (
            <div key={i} className={`group relative ${i > 0 ? "pt-4 border-t border-gs-border" : ""}`}>
              <div className="absolute -right-1 -top-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <DeleteBtn onClick={() => deleteNewsItem(i)} label="Remove this story" />
              </div>
              <EditableText
                value={item.headline}
                onChange={(v) =>
                  onChange((prev) => {
                    const news = [...prev.local_news];
                    news[i] = { ...news[i], headline: v };
                    return { ...prev, local_news: news };
                  })
                }
                className="font-bold text-gs-dark mb-1 font-serif text-base pr-6"
                placeholder="Headline…"
              />
              <EditableBlock
                value={item.body}
                onChange={(v) =>
                  onChange((prev) => {
                    const news = [...prev.local_news];
                    news[i] = { ...news[i], body: v };
                    return { ...prev, local_news: news };
                  })
                }
                className="text-gs-medium leading-relaxed"
                placeholder="Body…"
              />
            </div>
          ))}
        </div>
      )}

      {/* City connection */}
      {content.city_connection && (
        <div className="group relative bg-white border border-gs-border rounded-2xl p-4">
          <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <DeleteBtn onClick={() => onChange((prev) => ({ ...prev, city_connection: null! }))} label="Remove city connection" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gs-medium mb-2">
            In {neighborhoodName.split(" ").pop()} This Week
          </p>
          <EditableText
            value={content.city_connection.headline}
            onChange={(v) =>
              onChange((prev) => ({
                ...prev,
                city_connection: { ...prev.city_connection!, headline: v },
              }))
            }
            className="font-bold text-gs-dark mb-2 font-serif text-base pr-6"
            placeholder="City headline…"
          />
          <EditableBlock
            value={content.city_connection.body}
            onChange={(v) =>
              onChange((prev) => ({
                ...prev,
                city_connection: { ...prev.city_connection!, body: v },
              }))
            }
            className="text-gs-medium leading-relaxed"
            placeholder="City body…"
          />
        </div>
      )}

      {/* Neighborhood check-in — styled like email buttons */}
      {content.neighborhood_checkin && (
        <div className="group relative bg-white border border-gs-border rounded-2xl p-4">
          <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <DeleteBtn onClick={() => onChange((prev) => ({ ...prev, neighborhood_checkin: null! }))} label="Remove check-in" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gs-medium mb-2">Neighborhood Check-in</p>
          <EditableText
            value={content.neighborhood_checkin.question}
            onChange={(v) =>
              onChange((prev) => ({
                ...prev,
                neighborhood_checkin: { ...prev.neighborhood_checkin!, question: v },
              }))
            }
            className="font-semibold text-gs-dark mb-3 pr-6 text-base"
            placeholder="Poll question…"
          />
          <div className="space-y-2">
            {content.neighborhood_checkin.options.map((opt, i) => (
              <div key={i} className="group/opt relative flex items-center gap-2">
                <div className="flex-1 border-2 border-gs-border rounded-xl px-3 py-2.5 bg-gs-surface hover:border-gs-red/40 transition-colors">
                  <EditableText
                    value={opt}
                    onChange={(v) =>
                      onChange((prev) => {
                        const options = [...prev.neighborhood_checkin!.options];
                        options[i] = v;
                        return {
                          ...prev,
                          neighborhood_checkin: { ...prev.neighborhood_checkin!, options },
                        };
                      })
                    }
                    className="text-sm font-medium text-gs-dark"
                    placeholder={`Option ${i + 1}…`}
                  />
                </div>
                <span className="opacity-0 group-hover/opt:opacity-100 transition-opacity flex-shrink-0">
                  <DeleteBtn
                    onClick={() =>
                      onChange((prev) => ({
                        ...prev,
                        neighborhood_checkin: {
                          ...prev.neighborhood_checkin!,
                          options: prev.neighborhood_checkin!.options.filter((_, j) => j !== i),
                        },
                      }))
                    }
                    label="Remove option"
                  />
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gs-light mt-3">Results shared in next week&apos;s edition.</p>
        </div>
      )}

      {/* Nominate a neighbor — always shown, mirrors the email red card */}
      <div className="bg-gs-red rounded-2xl p-5">
        <p className="font-black text-white text-base leading-snug mb-1.5">
          Know a neighbor making a difference?
        </p>
        <p className="text-white/90 text-sm leading-relaxed mb-4">
          Every week we spotlight one person who makes {neighborhoodName} a better place. Drop their name — it takes 30 seconds.
        </p>
        <div className="inline-flex items-center gap-1.5 bg-white px-4 py-2 rounded-xl">
          <span className="font-black text-gs-red text-sm">Nominate someone</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-gs-red">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* Business spotlight */}
      {content.business_spotlight && (
        <div className="group relative bg-white border border-gs-border rounded-2xl p-4">
          <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <DeleteBtn onClick={() => onChange((prev) => ({ ...prev, business_spotlight: null }))} label="Remove business spotlight" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gs-medium mb-2">Business Spotlight</p>
          <EditableText
            value={content.business_spotlight.name}
            onChange={(v) =>
              onChange((prev) => ({
                ...prev,
                business_spotlight: { ...prev.business_spotlight!, name: v },
              }))
            }
            className="font-bold text-gs-dark pr-6 text-base"
            placeholder="Business name…"
          />
          <EditableText
            value={content.business_spotlight.location}
            onChange={(v) =>
              onChange((prev) => ({
                ...prev,
                business_spotlight: { ...prev.business_spotlight!, location: v },
              }))
            }
            className="text-xs text-gs-light font-semibold mb-2 uppercase tracking-wide"
            placeholder="Location…"
          />
          <EditableBlock
            value={content.business_spotlight.description}
            onChange={(v) =>
              onChange((prev) => ({
                ...prev,
                business_spotlight: { ...prev.business_spotlight!, description: v },
              }))
            }
            className="text-gs-medium leading-relaxed"
            placeholder="Description…"
          />
        </div>
      )}

      {/* DIY tip */}
      {content.diy_tip && (
        <div className="group relative bg-white border border-gs-border rounded-2xl p-4">
          <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <DeleteBtn onClick={() => onChange((prev) => ({ ...prev, diy_tip: null! }))} label="Remove DIY tip" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gs-medium mb-2">DIY Tip</p>
          <EditableText
            value={content.diy_tip.title}
            onChange={(v) =>
              onChange((prev) => ({ ...prev, diy_tip: { ...prev.diy_tip!, title: v } }))
            }
            className="font-bold text-gs-dark mb-2 pr-6 text-base"
            placeholder="Tip title…"
          />
          <EditableBlock
            value={content.diy_tip.body}
            onChange={(v) =>
              onChange((prev) => ({ ...prev, diy_tip: { ...prev.diy_tip!, body: v } }))
            }
            className="text-gs-medium leading-relaxed"
            placeholder="Tip body…"
          />
        </div>
      )}

      {/* Fun fact */}
      {content.fun_fact && (
        <div className="group relative bg-gs-surface border-l-4 border-gs-red rounded-r-2xl p-4">
          <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <DeleteBtn onClick={() => onChange((prev) => ({ ...prev, fun_fact: "" }))} label="Remove fun fact" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gs-medium mb-2">Fun Fact</p>
          <EditableBlock
            value={content.fun_fact}
            onChange={(v) => onChange((prev) => ({ ...prev, fun_fact: v }))}
            className="text-gs-dark italic leading-relaxed pr-6"
            placeholder="Fun fact…"
          />
        </div>
      )}
    </>
  );
}

// ── Legacy format (read-only) ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LegacyPreview({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5 text-xs text-yellow-700 font-semibold">
        Older newsletter format — editing not supported.
      </div>
      {Array.isArray(data.top_news) && data.top_news.length > 0 && (
        <Section title="Top News">
          {data.top_news.map((item: { headline: string; summary: string; local_angle?: string }, i: number) => (
            <div key={i} className="py-3 border-b border-gs-border last:border-0">
              <p className="font-bold text-gs-dark">{item.headline}</p>
              <p className="text-gs-medium mt-1">{item.summary}</p>
              {item.local_angle && <p className="text-xs text-gs-red font-semibold mt-1">{item.local_angle}</p>}
            </div>
          ))}
        </Section>
      )}
      {data.fun_fact && (
        <Section title="Fun Fact">
          <p className="text-gs-dark italic">&ldquo;{data.fun_fact}&rdquo;</p>
        </Section>
      )}
      {data.diy_tip && (
        <Section title="DIY Tip">
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
