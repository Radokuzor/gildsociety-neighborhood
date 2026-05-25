"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminIssue } from "@/app/admin/page";
import type { Database } from "@/types/database";
import NewsletterPreviewModal from "./NewsletterPreviewModal";

type Neighborhood = Database["public"]["Tables"]["neighborhoods"]["Row"];
type Nomination = Database["public"]["Tables"]["nominations"]["Row"];

interface Props {
  neighborhoods: Neighborhood[];
  issues: AdminIssue[];
  defaultNeighborhoodSlug: string;
  eventCounts: Array<{ issue_id: string | null; event_type: string }>;
  subCounts: Array<{ neighborhood_id: string }>;
  nominations: Nomination[];
}

type Tab = "newsletters" | "analytics" | "nominations" | "settings";

export default function AdminDashboard({
  neighborhoods,
  issues,
  defaultNeighborhoodSlug,
  eventCounts,
  subCounts,
  nominations,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("newsletters");
  const [generating, setGenerating] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [previewIssue, setPreviewIssue] = useState<AdminIssue | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // ── New neighborhood form ─────────────────────────────────────────────────
  const [newHood, setNewHood] = useState({ name: "", slug: "", city: "", state: "" });
  const [creatingHood, setCreatingHood] = useState(false);
  const [hoodError, setHoodError] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  // ── Computed analytics ────────────────────────────────────────────────────
  function getStats(issueId: string) {
    const events = eventCounts.filter((e) => e.issue_id === issueId);
    return {
      sent: events.filter((e) => e.event_type === "sent").length,
      opened: events.filter((e) => e.event_type === "opened").length,
      clicked: events.filter((e) => e.event_type === "clicked").length,
    };
  }

  function subCount(neighborhoodId: string) {
    return subCounts.filter((s) => s.neighborhood_id === neighborhoodId).length;
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  async function generateForNeighborhood(slug: string) {
    setGenerating(slug);
    try {
      const res = await fetch(
        `/api/cron/generate-newsletters?neighborhood=${slug}&admin_token=${encodeURIComponent(document.cookie.match(/admin_token=([^;]+)/)?.[1] ?? "")}`,
        { method: "GET" }
      );
      const data = await res.json() as { results: Array<{ status: string; neighborhood: string }> };
      const result = data.results?.[0];
      if (result?.status === "success") {
        showToast(`✅ Draft created for ${result.neighborhood}`);
        router.refresh();
      } else {
        showToast(`❌ Generation failed — check console`);
      }
    } catch {
      showToast("❌ Request failed");
    } finally {
      setGenerating(null);
    }
  }

  async function approveAndSend(issueId: string) {
    setSending(issueId);
    try {
      const res = await fetch("/api/admin/approve-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId }),
      });
      const data = await res.json() as { sent?: number; failed?: number; error?: string };
      if (res.ok) {
        showToast(`✅ Sent to ${data.sent} subscribers (${data.failed} failed)`);
        router.refresh();
      } else {
        showToast(`❌ ${data.error}`);
      }
    } catch {
      showToast("❌ Send failed");
    } finally {
      setSending(null);
    }
  }

  async function pinFeatured(neighborhoodId: string, issueId: string) {
    await fetch("/api/admin/pin-featured", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neighborhoodId, issueId }),
    });
    showToast("📌 Pinned as featured article on homepage");
    router.refresh();
  }

  async function setDefaultNeighborhood(slug: string) {
    await fetch("/api/admin/pin-featured", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    showToast(`🏠 Default neighborhood set to ${slug}`);
    router.refresh();
  }

  async function selectNomination(nominationId: string) {
    await fetch(`/api/admin/nomination?id=${nominationId}`, { method: "POST" });
    showToast("⭐ Nomination selected for next newsletter");
    router.refresh();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  // Auto-generate slug from name
  function handleNameChange(name: string) {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    setNewHood((prev) => ({ ...prev, name, slug }));
    setHoodError(null);
  }

  async function createNeighborhood() {
    setHoodError(null);
    if (!newHood.name || !newHood.slug || !newHood.city || !newHood.state) {
      setHoodError("All fields are required.");
      return;
    }
    setCreatingHood(true);
    try {
      const res = await fetch("/api/admin/neighborhoods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newHood),
      });
      const data = await res.json() as { neighborhood?: unknown; error?: string };
      if (res.ok) {
        showToast(`✅ "${newHood.name}" created!`);
        setNewHood({ name: "", slug: "", city: "", state: "" });
        router.refresh();
      } else {
        setHoodError(data.error ?? "Failed to create neighborhood");
      }
    } catch {
      setHoodError("Request failed — check your connection");
    } finally {
      setCreatingHood(false);
    }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "newsletters", label: "📰 Newsletters", count: issues.filter((i) => i.status === "draft").length || undefined },
    { id: "analytics", label: "📊 Analytics" },
    { id: "nominations", label: "⭐ Nominations", count: nominations.length || undefined },
    { id: "settings", label: "⚙️ Settings" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gs-red flex items-center justify-center">
            <span className="text-white font-black text-sm">G</span>
          </div>
          <div>
            <p className="font-black text-gs-dark">Gild Society Admin</p>
            <p className="text-xs text-gs-medium">Newsletter control panel</p>
          </div>
        </div>
        <button onClick={logout} className="text-xs text-gs-medium hover:text-gs-dark underline">
          Sign out
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Neighborhoods" value={neighborhoods.length} />
        <StatCard label="Total subscribers" value={subCounts.length} />
        <StatCard label="Newsletters sent" value={issues.filter((i) => i.status === "sent").length} />
        <StatCard label="Drafts pending" value={issues.filter((i) => i.status === "draft").length} color="red" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gs-surface rounded-2xl p-1 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-fit whitespace-nowrap text-sm font-semibold px-3 py-2 rounded-xl transition-all tap-none ${
              tab === t.id
                ? "bg-white text-gs-dark shadow-sm"
                : "text-gs-medium hover:text-gs-dark"
            }`}
          >
            {t.label}
            {t.count ? (
              <span className="ml-1.5 bg-gs-red text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {t.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Newsletters tab ─────────────────────────────────────────────────── */}
      {tab === "newsletters" && (
        <div className="space-y-4">
          {/* Generate section */}
          <div className="bg-white rounded-3xl border border-gs-border p-5">
            <p className="font-black text-gs-dark mb-1">Generate new newsletter</p>
            <p className="text-sm text-gs-medium mb-4">
              Scrapes news + generates a draft with Claude. You review before sending.
            </p>
            <div className="flex flex-wrap gap-2">
              {neighborhoods.map((hood) => (
                <button
                  key={hood.id}
                  onClick={() => generateForNeighborhood(hood.slug)}
                  disabled={!!generating}
                  className="px-4 py-2 bg-gs-surface border border-gs-border rounded-xl text-sm font-semibold text-gs-dark hover:border-gs-red hover:text-gs-red transition-all disabled:opacity-50 tap-none"
                >
                  {generating === hood.slug ? "Generating…" : `Generate for ${hood.name}`}
                </button>
              ))}
            </div>
          </div>

          {/* Issue list */}
          {issues.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gs-border p-8 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="font-bold text-gs-dark">No newsletters yet</p>
              <p className="text-sm text-gs-medium">Generate one above to get started.</p>
            </div>
          ) : (
            issues.map((issue) => {
              const stats = getStats(issue.id);
              const hoodName = issue.neighborhoods?.name ?? "Unknown";
              return (
                <div
                  key={issue.id}
                  className="bg-white rounded-3xl border border-gs-border p-5"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <StatusBadge status={issue.status} />
                        <span className="text-xs text-gs-medium font-semibold">{hoodName}</span>
                        <span className="text-xs text-gs-light">
                          {new Date(issue.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="font-black text-gs-dark truncate">{issue.subject}</p>
                      {issue.preview_text && (
                        <p className="text-xs text-gs-medium mt-0.5 truncate">{issue.preview_text}</p>
                      )}
                    </div>
                  </div>

                  {issue.status === "sent" && (
                    <div className="flex gap-4 mb-3 text-xs">
                      <span className="text-gs-medium">📤 {stats.sent} sent</span>
                      <span className="text-gs-medium">👁 {stats.opened} opens ({stats.sent ? Math.round((stats.opened / stats.sent) * 100) : 0}%)</span>
                      <span className="text-gs-medium">🖱 {stats.clicked} clicks</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setPreviewIssue(issue)}
                      className="px-3 py-1.5 text-xs font-semibold border border-gs-border rounded-xl hover:border-gs-dark transition-colors tap-none"
                    >
                      Preview
                    </button>

                    {issue.status === "draft" && (
                      <button
                        onClick={() => approveAndSend(issue.id)}
                        disabled={sending === issue.id}
                        className="px-3 py-1.5 text-xs font-bold bg-gs-red text-white rounded-xl hover:bg-gs-red-dark transition-colors disabled:opacity-50 tap-none"
                      >
                        {sending === issue.id ? "Sending…" : "Approve & Send"}
                      </button>
                    )}

                    {issue.status === "sent" && issue.neighborhoods && (
                      <button
                        onClick={() => {
                          const hood = neighborhoods.find((n) => n.id === issue.neighborhood_id);
                          if (hood) pinFeatured(hood.id, issue.id);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold border border-gs-border rounded-xl hover:border-gs-red hover:text-gs-red transition-colors tap-none"
                      >
                        📌 Pin to homepage
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Analytics tab ───────────────────────────────────────────────────── */}
      {tab === "analytics" && (
        <div className="space-y-4">
          {neighborhoods.map((hood) => {
            const hoodIssues = issues.filter(
              (i) => i.neighborhood_id === hood.id && i.status === "sent"
            );
            const totalSent = hoodIssues.reduce(
              (sum, i) => sum + getStats(i.id).sent, 0
            );
            const totalOpened = hoodIssues.reduce(
              (sum, i) => sum + getStats(i.id).opened, 0
            );
            const subs = subCount(hood.id);

            return (
              <div key={hood.id} className="bg-white rounded-3xl border border-gs-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-black text-gs-dark">{hood.name}</p>
                  <span className="text-xs bg-gs-surface px-2.5 py-1 rounded-full font-semibold text-gs-medium">
                    {subs} subscriber{subs !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <MiniStat label="Issues sent" value={hoodIssues.length} />
                  <MiniStat label="Total delivered" value={totalSent} />
                  <MiniStat
                    label="Avg open rate"
                    value={totalSent ? `${Math.round((totalOpened / totalSent) * 100)}%` : "—"}
                  />
                </div>
                {hoodIssues.length > 0 && (
                  <div className="space-y-2">
                    {hoodIssues.slice(0, 5).map((issue) => {
                      const s = getStats(issue.id);
                      const openRate = s.sent ? Math.round((s.opened / s.sent) * 100) : 0;
                      return (
                        <div key={issue.id} className="flex items-center justify-between text-sm">
                          <span className="text-gs-dark truncate flex-1 mr-2">{issue.subject}</span>
                          <div className="flex gap-3 text-xs text-gs-medium flex-shrink-0">
                            <span>📤 {s.sent}</span>
                            <span>👁 {openRate}%</span>
                            <span>🖱 {s.clicked}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Nominations tab ─────────────────────────────────────────────────── */}
      {tab === "nominations" && (
        <div className="space-y-4">
          {nominations.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gs-border p-8 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="font-bold text-gs-dark">No pending nominations</p>
              <p className="text-sm text-gs-medium">Nominations submitted by residents appear here.</p>
            </div>
          ) : (
            nominations.map((nom) => {
              const hood = neighborhoods.find((n) => n.id === nom.neighborhood_id);
              return (
                <div key={nom.id} className="bg-white rounded-3xl border border-gs-border p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-gs-surface px-2 py-0.5 rounded-full font-semibold text-gs-medium">
                          {hood?.name ?? "Unknown"}
                        </span>
                        <span className="text-xs text-gs-light">
                          {new Date(nom.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="font-black text-gs-dark text-lg">{nom.nominee_name}</p>
                      <p className="text-sm text-gs-medium mt-1 leading-relaxed">
                        {nom.nominee_description}
                      </p>
                      {nom.submitted_by_email && (
                        <p className="text-xs text-gs-light mt-2">
                          Submitted by {nom.submitted_by_email}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => selectNomination(nom.id)}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-bold bg-gs-dark text-white rounded-xl hover:bg-gs-dark/90 transition-colors tap-none"
                    >
                      ⭐ Select
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Settings tab ────────────────────────────────────────────────────── */}
      {tab === "settings" && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-gs-border p-5">
            <p className="font-black text-gs-dark mb-1">Default homepage neighborhood</p>
            <p className="text-sm text-gs-medium mb-4">
              The neighborhood shown when someone hits gildsociety.com without a QR code context.
            </p>
            <div className="flex flex-wrap gap-2">
              {neighborhoods.map((hood) => (
                <button
                  key={hood.id}
                  onClick={() => setDefaultNeighborhood(hood.slug)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all tap-none ${
                    defaultNeighborhoodSlug === hood.slug
                      ? "border-gs-red bg-accent text-gs-red"
                      : "border-gs-border text-gs-dark hover:border-gs-red/40"
                  }`}
                >
                  {hood.name}
                  {defaultNeighborhoodSlug === hood.slug && " ✓"}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gs-border p-5">
            <p className="font-black text-gs-dark mb-1">Newsletter schedule</p>
            <p className="text-sm text-gs-medium mb-2">
              Currently: <strong>Every Tuesday at 9am CT</strong> (auto via Vercel Cron)
            </p>
            <p className="text-xs text-gs-light">
              To change, update the cron schedule in <code className="bg-gs-surface px-1 rounded">vercel.json</code> and redeploy.
              <br />Current: <code className="bg-gs-surface px-1 rounded">0 14 * * 2</code> (Tues 2pm UTC = 9am CT)
            </p>
          </div>

          {/* ── Create new neighborhood ─────────────────────────────────── */}
          <div className="bg-white rounded-3xl border border-gs-border p-5">
            <p className="font-black text-gs-dark mb-1">Add neighborhood</p>
            <p className="text-sm text-gs-medium mb-4">
              New neighborhoods appear in the homepage selector immediately.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-semibold text-gs-medium uppercase tracking-wider mb-1 block">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="Wildhorse Ranch"
                  value={newHood.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full border border-gs-border rounded-xl px-3 py-2 text-sm text-gs-dark placeholder:text-gs-light focus:outline-none focus:border-gs-red transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gs-medium uppercase tracking-wider mb-1 block">
                  Slug <span className="text-gs-light font-normal">(auto-generated)</span>
                </label>
                <input
                  type="text"
                  placeholder="wildhorse-ranch"
                  value={newHood.slug}
                  onChange={(e) => {
                    setNewHood((prev) => ({ ...prev, slug: e.target.value }));
                    setHoodError(null);
                  }}
                  className="w-full border border-gs-border rounded-xl px-3 py-2 text-sm text-gs-dark placeholder:text-gs-light focus:outline-none focus:border-gs-red transition-colors font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gs-medium uppercase tracking-wider mb-1 block">
                  City
                </label>
                <input
                  type="text"
                  placeholder="Austin"
                  value={newHood.city}
                  onChange={(e) => {
                    setNewHood((prev) => ({ ...prev, city: e.target.value }));
                    setHoodError(null);
                  }}
                  className="w-full border border-gs-border rounded-xl px-3 py-2 text-sm text-gs-dark placeholder:text-gs-light focus:outline-none focus:border-gs-red transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gs-medium uppercase tracking-wider mb-1 block">
                  State
                </label>
                <input
                  type="text"
                  placeholder="TX"
                  maxLength={2}
                  value={newHood.state}
                  onChange={(e) => {
                    setNewHood((prev) => ({ ...prev, state: e.target.value.toUpperCase() }));
                    setHoodError(null);
                  }}
                  className="w-full border border-gs-border rounded-xl px-3 py-2 text-sm text-gs-dark placeholder:text-gs-light focus:outline-none focus:border-gs-red transition-colors uppercase"
                />
              </div>
            </div>
            {hoodError && (
              <p className="text-xs text-red-600 font-semibold mb-3">⚠️ {hoodError}</p>
            )}
            <button
              onClick={createNeighborhood}
              disabled={creatingHood}
              className="px-5 py-2 bg-gs-red text-white text-sm font-bold rounded-xl hover:bg-gs-red/90 transition-colors disabled:opacity-50 tap-none"
            >
              {creatingHood ? "Creating…" : "Create neighborhood →"}
            </button>
          </div>

          {/* ── Existing neighborhoods list ─────────────────────────────── */}
          <div className="bg-white rounded-3xl border border-gs-border p-5">
            <p className="font-black text-gs-dark mb-1">Neighborhoods</p>
            <div className="space-y-2">
              {neighborhoods.length === 0 ? (
                <p className="text-sm text-gs-medium py-4 text-center">No neighborhoods yet — create one above.</p>
              ) : neighborhoods.map((hood) => (
                <div key={hood.id} className="flex items-center justify-between py-2 border-b border-gs-border last:border-0">
                  <div>
                    <p className="font-semibold text-gs-dark text-sm">{hood.name}</p>
                    <p className="text-xs text-gs-medium">{hood.city}, {hood.state} · {subCount(hood.id)} subscribers</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${hood.active ? "bg-green-100 text-green-700" : "bg-gs-surface text-gs-medium"}`}>
                    {hood.active ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gs-dark text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* Newsletter preview modal */}
      {previewIssue && (
        <NewsletterPreviewModal
          issue={previewIssue}
          onClose={() => setPreviewIssue(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: "red";
}) {
  return (
    <div className="bg-white rounded-2xl border border-gs-border p-4">
      <p className={`text-2xl font-black mb-0.5 ${color === "red" && value > 0 ? "text-gs-red" : "text-gs-dark"}`}>
        {value}
      </p>
      <p className="text-xs text-gs-medium">{label}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-gs-surface rounded-xl p-3 text-center">
      <p className="font-black text-gs-dark">{value}</p>
      <p className="text-xs text-gs-medium">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft: { label: "Draft", cls: "bg-yellow-100 text-yellow-700" },
    approved: { label: "Approved", cls: "bg-blue-100 text-blue-700" },
    sent: { label: "Sent", cls: "bg-green-100 text-green-700" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-gs-surface text-gs-medium" };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}
