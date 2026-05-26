"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AdminIssue } from "@/app/admin/page";
import type { Database } from "@/types/database";
import type { NewsletterSeeds } from "@/lib/claude";
import type { ScrapedArticle } from "@/lib/scraper";
import NewsletterPreviewModal from "./NewsletterPreviewModal";

type Neighborhood = Database["public"]["Tables"]["neighborhoods"]["Row"];
type Nomination = Database["public"]["Tables"]["nominations"]["Row"];
type ZipRow = Database["public"]["Tables"]["zip_neighborhood_map"]["Row"];

interface Props {
  neighborhoods: Neighborhood[];
  issues: AdminIssue[];
  defaultNeighborhoodSlug: string;
  eventCounts: Array<{ issue_id: string | null; event_type: string }>;
  subCounts: Array<{ neighborhood_id: string }>;
  nominations: Nomination[];
}

type Tab = "newsletters" | "analytics" | "nominations" | "settings" | "subscribers";

type SubscriberRow = {
  id: string;
  user_id: string;
  neighborhood_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
};

// ── Advanced seed form (collapsed by default) ─────────────────────────────────
interface AdvancedSeeds {
  localNotes: string;        // Anything NewsAPI missed — passed to Claude as adminNotes
  checkinSeed: string;
  businessName: string;
  businessDescription: string;
  businessLocation: string;
  diyTipSeed: string;
  funFactSeed: string;
}

const emptyAdvanced = (): AdvancedSeeds => ({
  localNotes: "",
  checkinSeed: "",
  businessName: "",
  businessDescription: "",
  businessLocation: "",
  diyTipSeed: "",
  funFactSeed: "",
});

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
  const [localIssues, setLocalIssues] = useState<AdminIssue[]>(issues);
  const [sending, setSending] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [previewIssue, setPreviewIssue] = useState<AdminIssue | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

  // ── Topic picker state ────────────────────────────────────────────────────────
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [topicLoading, setTopicLoading] = useState(false);
  const [topicArticles, setTopicArticles] = useState<ScrapedArticle[]>([]);
  const [topicError, setTopicError] = useState<string | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advanced, setAdvanced] = useState<AdvancedSeeds>(emptyAdvanced());

  // ── Neighborhood admin forms ──────────────────────────────────────────────────
  const [newHood, setNewHood] = useState({ name: "", slug: "", city: "", state: "" });
  const [creatingHood, setCreatingHood] = useState(false);
  const [hoodError, setHoodError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", city: "", state: "", active: true });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ── Subscribers state ─────────────────────────────────────────────────────────
  const [expandedSubHood, setExpandedSubHood] = useState<string | null>(null);
  const [subsByHood, setSubsByHood] = useState<Record<string, SubscriberRow[]>>({});
  const [loadingSubs, setLoadingSubs] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ subscriberId: string; email: string | null; neighborhoodName: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Zip code state ────────────────────────────────────────────────────────────
  const [expandedZips, setExpandedZips] = useState<string | null>(null);
  const [zipsByHood, setZipsByHood] = useState<Record<string, ZipRow[]>>({});
  const [loadingZips, setLoadingZips] = useState<string | null>(null);
  const [newZip, setNewZip] = useState("");
  const [addingZip, setAddingZip] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  useEffect(() => { setLocalIssues(issues); }, [issues]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  // ── Topic picker ──────────────────────────────────────────────────────────────
  async function openTopicPicker(slug: string) {
    if (expandedSlug === slug) {
      setExpandedSlug(null);
      return;
    }
    // Reset state for the new neighborhood
    setExpandedSlug(slug);
    setTopicArticles([]);
    setSelectedUrls(new Set());
    setTopicError(null);
    setShowAdvanced(false);
    setAdvanced(emptyAdvanced());

    // Auto-search immediately
    setTopicLoading(true);
    try {
      const res = await fetch(`/api/admin/topic-search?neighborhood=${slug}`, {
        credentials: "same-origin",
      });
      const data = await res.json() as { articles?: ScrapedArticle[]; error?: string };
      if (res.ok && data.articles) {
        setTopicArticles(data.articles);
      } else {
        setTopicError(data.error ?? "Search failed — try again");
      }
    } catch {
      setTopicError("Request failed");
    } finally {
      setTopicLoading(false);
    }
  }

  function toggleArticle(url: string) {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function selectAll() {
    setSelectedUrls(new Set(topicArticles.map((a) => a.url)));
  }

  function clearAll() {
    setSelectedUrls(new Set());
  }

  // ── Generate ──────────────────────────────────────────────────────────────────
  async function generateForNeighborhood(slug: string) {
    setGenerating(slug);

    const selectedArticles = topicArticles.filter((a) => selectedUrls.has(a.url));

    // Build seeds from advanced form
    const seeds: NewsletterSeeds = {};
    if (advanced.localNotes.trim()) seeds.adminNotes = advanced.localNotes.trim();
    if (advanced.checkinSeed.trim()) seeds.checkinSeed = advanced.checkinSeed.trim();
    if (advanced.businessName.trim()) {
      seeds.businessSpotlightSeed = {
        name: advanced.businessName.trim(),
        description: advanced.businessDescription.trim(),
        location: advanced.businessLocation.trim(),
      };
    }
    if (advanced.diyTipSeed.trim()) seeds.diyTipSeed = advanced.diyTipSeed.trim();
    if (advanced.funFactSeed.trim()) seeds.funFactSeed = advanced.funFactSeed.trim();

    try {
      const res = await fetch("/api/cron/generate-newsletters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ neighborhood: slug, selectedArticles, seeds }),
      });
      const data = await res.json() as {
        results: Array<{ status: string; neighborhood: string; draft?: AdminIssue }>;
      };
      const result = data.results?.[0];
      if (result?.status === "success") {
        showToast(`Draft created for ${result.neighborhood}`);
        if (result.draft) setLocalIssues((prev) => [result.draft!, ...prev]);
        setExpandedSlug(null);
      } else {
        showToast("Generation failed — check console");
      }
    } catch {
      showToast("Request failed");
    } finally {
      setGenerating(null);
    }
  }

  // ── Other actions ─────────────────────────────────────────────────────────────
  async function approveAndSend(issueId: string) {
    setSending(issueId);
    try {
      const res = await fetch("/api/admin/approve-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ issueId }),
      });
      let data: { sent?: number; failed?: number; status?: string; error?: string; message?: string } = {};
      try {
        data = await res.json() as typeof data;
      } catch {
        showToast(`Send failed (status ${res.status})`);
        return;
      }
      if (res.ok) {
        // Build a meaningful toast — handle 0-subscriber, partial, and full sends
        let msg: string;
        if (data.message) {
          msg = data.message;
        } else if (typeof data.sent === "number") {
          msg = data.failed
            ? `Sent to ${data.sent} of ${data.total} subscribers (${data.failed} failed)`
            : `Sent to ${data.sent} subscriber${data.sent !== 1 ? "s" : ""} ✓`;
        } else {
          msg = "Sent ✓";
        }
        showToast(msg);
        // The API always updates DB status to "sent" on a 200 response — mirror that locally
        setLocalIssues((prev) =>
          prev.map((i) => i.id === issueId ? { ...i, status: "sent", sent_at: new Date().toISOString() } : i)
        );
      } else {
        showToast(data.error ?? `Send failed (${res.status})`);
      }
    } catch {
      showToast("Send failed");
    } finally {
      setSending(null);
    }
  }

  async function pinFeatured(neighborhoodId: string, issueId: string) {
    const res = await fetch("/api/admin/pin-featured", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",   // ← required: sends admin_token cookie
      body: JSON.stringify({ neighborhoodId, issueId }),
    });
    if (res.ok) {
      showToast("Pinned as featured article on homepage ✓");
    } else {
      showToast("Failed to pin — try again");
    }
    // Do NOT router.refresh() here — it resets all local state and can wipe the issue list
  }

  async function setDefaultNeighborhood(slug: string) {
    await fetch("/api/admin/pin-featured", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",   // ← required: sends admin_token cookie
      body: JSON.stringify({ slug }),
    });
    showToast(`Default neighborhood set to ${slug}`);
    router.refresh();
  }

  async function selectNomination(nominationId: string) {
    await fetch(`/api/admin/nomination?id=${nominationId}`, { method: "POST" });
    showToast("Nomination selected for next newsletter");
    router.refresh();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  function handleNameChange(name: string) {
    const slug = name.toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
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
        showToast(`"${newHood.name}" created`);
        setNewHood({ name: "", slug: "", city: "", state: "" });
        router.refresh();
      } else {
        setHoodError(data.error ?? "Failed to create neighborhood");
      }
    } catch {
      setHoodError("Request failed");
    } finally {
      setCreatingHood(false);
    }
  }

  function startEdit(hood: Neighborhood) {
    setEditingId(hood.id);
    setEditForm({ name: hood.name, city: hood.city, state: hood.state, active: hood.active });
    setEditError(null);
  }

  function cancelEdit() { setEditingId(null); setEditError(null); }

  async function saveEdit(id: string) {
    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch("/api/admin/neighborhoods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editForm }),
      });
      const data = await res.json() as { neighborhood?: unknown; error?: string };
      if (res.ok) {
        showToast("Neighborhood updated");
        setEditingId(null);
        router.refresh();
      } else {
        setEditError(data.error ?? "Failed to save");
      }
    } catch {
      setEditError("Request failed");
    } finally {
      setSavingEdit(false);
    }
  }

  // ── Subscriber actions ────────────────────────────────────────────────────────
  const loadSubscribers = useCallback(async (neighborhoodId: string) => {
    setLoadingSubs(neighborhoodId);
    try {
      const res = await fetch(`/api/admin/subscribers?neighborhoodId=${neighborhoodId}`, { credentials: "same-origin" });
      const data = await res.json() as { subscribers?: SubscriberRow[] };
      if (res.ok) setSubsByHood((prev) => ({ ...prev, [neighborhoodId]: data.subscribers ?? [] }));
    } finally {
      setLoadingSubs(null);
    }
  }, []);

  function toggleSubHood(neighborhoodId: string) {
    if (expandedSubHood === neighborhoodId) { setExpandedSubHood(null); return; }
    setExpandedSubHood(neighborhoodId);
    if (!subsByHood[neighborhoodId]) void loadSubscribers(neighborhoodId);
  }

  async function confirmDeleteSubscriber() {
    if (!deleteConfirm) return;
    setDeletingId(deleteConfirm.subscriberId);
    try {
      const res = await fetch(`/api/admin/subscribers?id=${deleteConfirm.subscriberId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (res.ok) {
        setSubsByHood((prev) => {
          const updated = { ...prev };
          for (const hoodId in updated) {
            updated[hoodId] = updated[hoodId].filter((s) => s.id !== deleteConfirm.subscriberId);
          }
          return updated;
        });
        showToast(`${deleteConfirm.email ?? "Subscriber"} removed`);
      } else {
        showToast("Failed to delete subscriber");
      }
    } catch {
      showToast("Request failed");
    } finally {
      setDeletingId(null);
      setDeleteConfirm(null);
    }
  }

  const loadZips = useCallback(async (neighborhoodId: string) => {
    setLoadingZips(neighborhoodId);
    try {
      const res = await fetch(`/api/admin/zip-codes?neighborhoodId=${neighborhoodId}`, { credentials: "same-origin" });
      const data = await res.json() as { zipCodes?: ZipRow[] };
      if (res.ok) setZipsByHood((prev) => ({ ...prev, [neighborhoodId]: data.zipCodes ?? [] }));
    } finally {
      setLoadingZips(null);
    }
  }, []);

  function toggleZips(neighborhoodId: string) {
    if (expandedZips === neighborhoodId) { setExpandedZips(null); return; }
    setExpandedZips(neighborhoodId);
    setNewZip(""); setZipError(null);
    if (!zipsByHood[neighborhoodId]) void loadZips(neighborhoodId);
  }

  async function addZip(neighborhoodId: string) {
    const trimmed = newZip.replace(/\D/g, "").slice(0, 5);
    if (trimmed.length !== 5) { setZipError("Enter a valid 5-digit ZIP code"); return; }
    setAddingZip(true); setZipError(null);
    try {
      const res = await fetch("/api/admin/zip-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ neighborhoodId, zipCode: trimmed }),
      });
      const data = await res.json() as { zipCode?: ZipRow; error?: string };
      if (res.ok && data.zipCode) {
        setZipsByHood((prev) => ({
          ...prev,
          [neighborhoodId]: [...(prev[neighborhoodId] ?? []), data.zipCode!].sort((a, b) => a.zip_code.localeCompare(b.zip_code)),
        }));
        setNewZip(""); showToast(`ZIP ${trimmed} added`);
      } else {
        setZipError(data.error ?? "Failed to add ZIP");
      }
    } catch { setZipError("Request failed"); } finally { setAddingZip(false); }
  }

  async function removeZip(neighborhoodId: string, zipId: string, zipCode: string) {
    try {
      const res = await fetch(`/api/admin/zip-codes?id=${zipId}`, { method: "DELETE", credentials: "same-origin" });
      if (res.ok) {
        setZipsByHood((prev) => ({ ...prev, [neighborhoodId]: (prev[neighborhoodId] ?? []).filter((z) => z.id !== zipId) }));
        showToast(`ZIP ${zipCode} removed`);
      }
    } catch { showToast("Failed to remove ZIP"); }
  }

  function getStats(issueId: string) {
    const events = eventCounts.filter((e) => e.issue_id === issueId);
    const attempted  = events.filter((e) => e.event_type === "sent").length;
    const delivered  = events.filter((e) => e.event_type === "delivered").length;
    const opened     = events.filter((e) => e.event_type === "opened").length;
    const clicked    = events.filter((e) => e.event_type === "clicked").length;
    return {
      // "sent" = manual attempt log; "delivered" = Resend webhook confirmation.
      // Show confirmed delivered when available, otherwise fall back to attempted.
      sent:      attempted,
      delivered: delivered > 0 ? delivered : attempted,
      opened,
      clicked,
    };
  }
  function subCount(neighborhoodId: string) {
    return subCounts.filter((s) => s.neighborhood_id === neighborhoodId).length;
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "newsletters", label: "Newsletters", count: localIssues.filter((i) => i.status === "draft").length || undefined },
    { id: "analytics", label: "Analytics" },
    { id: "subscribers", label: "Subscribers" },
    { id: "nominations", label: "Nominations", count: nominations.length || undefined },
    { id: "settings", label: "Settings" },
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
        <button onClick={logout} className="text-xs text-gs-medium hover:text-gs-dark underline">Sign out</button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Neighborhoods" value={neighborhoods.length} onClick={() => setTab("subscribers")} />
        <StatCard label="Subscribers" value={subCounts.length} onClick={() => setTab("subscribers")} />
        <StatCard label="Sent" value={localIssues.filter((i) => i.status === "sent").length} />
        <StatCard label="Drafts" value={localIssues.filter((i) => i.status === "draft").length} color="red" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gs-surface rounded-2xl p-1 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 min-w-fit whitespace-nowrap text-sm font-semibold px-3 py-2 rounded-xl transition-all tap-none ${tab === t.id ? "bg-white text-gs-dark shadow-sm" : "text-gs-medium hover:text-gs-dark"}`}>
            {t.label}
            {t.count ? <span className="ml-1.5 bg-gs-red text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {/* ── Newsletters ───────────────────────────────────────────────────────── */}
      {tab === "newsletters" && (
        <div className="space-y-4">
          {/* Generate section */}
          <div className="bg-white rounded-3xl border border-gs-border p-5">
            <p className="font-black text-gs-dark mb-1">New newsletter</p>
            <p className="text-sm text-gs-medium mb-4">
              Pick a neighborhood — we&apos;ll pull this week&apos;s news and let you choose what to write about.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {neighborhoods.map((hood) => (
                <button key={hood.id}
                  onClick={() => void openTopicPicker(hood.slug)}
                  disabled={!!generating}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all disabled:opacity-50 tap-none ${
                    expandedSlug === hood.slug
                      ? "border-gs-red text-gs-red bg-accent"
                      : "border-gs-border text-gs-dark hover:border-gs-red hover:text-gs-red"
                  }`}>
                  {generating === hood.slug ? (
                    <span className="flex items-center gap-1.5">
                      <Spinner />Generating…
                    </span>
                  ) : (
                    `${expandedSlug === hood.slug ? "▲" : "▼"} ${hood.name}`
                  )}
                </button>
              ))}
            </div>

            {/* Topic picker panel */}
            {expandedSlug && (() => {
              const hood = neighborhoods.find((n) => n.slug === expandedSlug);
              if (!hood) return null;
              return (
                <TopicPickerPanel
                  hood={hood}
                  loading={topicLoading}
                  articles={topicArticles}
                  error={topicError}
                  selectedUrls={selectedUrls}
                  onToggle={toggleArticle}
                  onSelectAll={selectAll}
                  onClearAll={clearAll}
                  showAdvanced={showAdvanced}
                  onToggleAdvanced={() => setShowAdvanced((v) => !v)}
                  advanced={advanced}
                  onAdvancedChange={setAdvanced}
                  generating={generating === hood.slug}
                  onGenerate={() => void generateForNeighborhood(hood.slug)}
                  onCancel={() => setExpandedSlug(null)}
                />
              );
            })()}
          </div>

          {/* Issue list */}
          {localIssues.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gs-border p-8 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="font-bold text-gs-dark">No newsletters yet</p>
              <p className="text-sm text-gs-medium">Generate one above to get started.</p>
            </div>
          ) : (
            localIssues.map((issue) => {
              const stats = getStats(issue.id);
              const hoodName = neighborhoods.find((n) => n.id === issue.neighborhood_id)?.name ?? "Unknown";
              const isExpanded = expandedIssueId === issue.id;
              const openRate = stats.delivered ? Math.round((stats.opened / stats.delivered) * 100) : 0;
              const clickRate = stats.opened ? Math.round((stats.clicked / stats.opened) * 100) : 0;
              return (
                <div key={issue.id} className={`bg-white rounded-3xl border transition-all ${isExpanded ? "border-gs-red/30 shadow-sm" : "border-gs-border"}`}>
                  {/* Clickable header row */}
                  <button
                    onClick={() => setExpandedIssueId(isExpanded ? null : issue.id)}
                    className="w-full text-left p-5 tap-none"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <StatusBadge status={issue.status} />
                          <span className="text-xs text-gs-medium font-semibold">{hoodName}</span>
                          <span className="text-xs text-gs-light">
                            {issue.status === "sent" && issue.sent_at
                              ? new Date(issue.sent_at).toLocaleDateString()
                              : new Date(issue.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="font-black text-gs-dark truncate">{issue.subject}</p>
                        {issue.preview_text && <p className="text-xs text-gs-medium mt-0.5 truncate">{issue.preview_text}</p>}
                      </div>
                      {/* Inline stats pill for sent issues */}
                      {issue.status === "sent" && (
                        <div className="flex-shrink-0 flex items-center gap-3 text-xs text-gs-medium">
                          <span className="hidden sm:inline">{stats.delivered} delivered</span>
                          <span className="hidden sm:inline">{openRate}% open</span>
                          <span className={`text-gs-light transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                        </div>
                      )}
                      {issue.status === "draft" && (
                        <span className={`text-gs-light transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                      )}
                    </div>
                  </button>

                  {/* Expanded stats + actions */}
                  {isExpanded && (
                    <div className="border-t border-gs-border/60 px-5 pb-5 pt-4">
                      {/* Stats grid for sent issues */}
                      {issue.status === "sent" && (
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="bg-gs-surface rounded-2xl p-3 text-center">
                            <p className="text-xl font-black text-gs-dark">{stats.delivered}</p>
                            <p className="text-xs text-gs-medium mt-0.5">Delivered</p>
                          </div>
                          <div className="bg-gs-surface rounded-2xl p-3 text-center">
                            <p className="text-xl font-black text-gs-dark">{stats.opened}</p>
                            <p className="text-xs text-gs-medium mt-0.5">Opens · {openRate}%</p>
                          </div>
                          <div className="bg-gs-surface rounded-2xl p-3 text-center">
                            <p className="text-xl font-black text-gs-dark">{stats.clicked}</p>
                            <p className="text-xs text-gs-medium mt-0.5">Clicks · {clickRate}%</p>
                          </div>
                        </div>
                      )}

                      {/* Draft notice */}
                      {issue.status === "draft" && (
                        <p className="text-xs text-gs-medium mb-4">This draft hasn&apos;t been sent yet. Review it, then approve to send.</p>
                      )}

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setPreviewIssue(issue)}
                          className="px-3 py-1.5 text-xs font-semibold border border-gs-border rounded-xl hover:border-gs-dark transition-colors tap-none">
                          Preview
                        </button>
                        {issue.status === "draft" && (
                          <button onClick={() => approveAndSend(issue.id)} disabled={sending === issue.id}
                            className="px-3 py-1.5 text-xs font-bold bg-gs-red text-white rounded-xl hover:bg-gs-red/90 transition-colors disabled:opacity-50 tap-none">
                            {sending === issue.id ? "Sending…" : "Approve & Send"}
                          </button>
                        )}
                        {issue.status === "sent" && (
                          <button onClick={() => void pinFeatured(issue.neighborhood_id, issue.id)}
                            className="px-3 py-1.5 text-xs font-semibold border border-gs-border rounded-xl hover:border-gs-red hover:text-gs-red transition-colors tap-none">
                            Pin to homepage
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Analytics ─────────────────────────────────────────────────────────── */}
      {tab === "analytics" && (
        <div className="space-y-4">
          {neighborhoods.map((hood) => {
            const hoodIssues = localIssues.filter((i) => i.neighborhood_id === hood.id && i.status === "sent");
            const totalDelivered = hoodIssues.reduce((s, i) => s + getStats(i.id).delivered, 0);
            const totalOpened = hoodIssues.reduce((s, i) => s + getStats(i.id).opened, 0);
            const subs = subCount(hood.id);
            return (
              <div key={hood.id} className="bg-white rounded-3xl border border-gs-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-black text-gs-dark">{hood.name}</p>
                  <span className="text-xs bg-gs-surface px-2.5 py-1 rounded-full font-semibold text-gs-medium">{subs} subscriber{subs !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <MiniStat label="Issues sent" value={hoodIssues.length} />
                  <MiniStat label="Delivered" value={totalDelivered} />
                  <MiniStat label="Avg open rate" value={totalDelivered ? `${Math.round((totalOpened / totalDelivered) * 100)}%` : "—"} />
                </div>
                {hoodIssues.length > 0 && (
                  <div className="space-y-2">
                    {hoodIssues.slice(0, 5).map((issue) => {
                      const s = getStats(issue.id);
                      return (
                        <div key={issue.id} className="flex items-center justify-between text-sm">
                          <span className="text-gs-dark truncate flex-1 mr-2">{issue.subject}</span>
                          <div className="flex gap-3 text-xs text-gs-medium flex-shrink-0">
                            <span>{s.delivered} delivered</span>
                            <span>{s.delivered ? Math.round((s.opened / s.delivered) * 100) : 0}% open</span>
                            <span>{s.clicked} click{s.clicked !== 1 ? "s" : ""}</span>
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

      {/* ── Subscribers ───────────────────────────────────────────────────────── */}
      {tab === "subscribers" && (
        <div className="space-y-3">
          <div className="bg-white rounded-3xl border border-gs-border p-5">
            <p className="font-black text-gs-dark mb-1">Subscribers by neighborhood</p>
            <p className="text-sm text-gs-medium">Click a neighborhood to view its subscribers. Delete a subscriber so they can re-sign up.</p>
          </div>

          {neighborhoods.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gs-border p-8 text-center">
              <p className="text-4xl mb-3">🏘️</p>
              <p className="font-bold text-gs-dark">No neighborhoods yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gs-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gs-border bg-gs-surface">
                    <th className="text-left px-5 py-3 text-xs font-black uppercase tracking-wider text-gs-medium">Neighborhood</th>
                    <th className="text-right px-5 py-3 text-xs font-black uppercase tracking-wider text-gs-medium">Subscribers</th>
                    <th className="px-5 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {neighborhoods.map((hood, idx) => {
                    const count = subCount(hood.id);
                    const isExpanded = expandedSubHood === hood.id;
                    const subs = subsByHood[hood.id] ?? [];
                    const isLoading = loadingSubs === hood.id;
                    return (
                      <React.Fragment key={hood.id}>
                        <tr
                          onClick={() => toggleSubHood(hood.id)}
                          className={`cursor-pointer transition-colors ${isExpanded ? "bg-accent" : "hover:bg-gs-surface"} ${idx !== 0 ? "border-t border-gs-border" : ""}`}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gs-dark">{hood.name}</span>
                              <span className="text-xs text-gs-light">{hood.city}, {hood.state}</span>
                              {!hood.active && <span className="text-xs bg-gs-surface text-gs-medium px-1.5 py-0.5 rounded-full font-semibold">Inactive</span>}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className={`text-sm font-bold ${count > 0 ? "text-gs-dark" : "text-gs-light"}`}>{count}</span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <span className={`text-gs-light text-xs transition-transform inline-block ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                          </td>
                        </tr>

                        {/* Accordion subscriber rows */}
                        {isExpanded && (
                          <tr key={`${hood.id}-subs`} className="border-t border-gs-red/10">
                            <td colSpan={3} className="px-0 py-0">
                              <div className="bg-accent border-b border-gs-red/10">
                                {isLoading ? (
                                  <div className="flex items-center gap-2 px-6 py-5 text-sm text-gs-medium">
                                    <Spinner /> Loading subscribers…
                                  </div>
                                ) : subs.length === 0 ? (
                                  <p className="px-6 py-5 text-sm text-gs-medium">No subscribers yet for {hood.name}.</p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-gs-red/10">
                                          <th className="text-left px-6 py-2.5 text-xs font-black uppercase tracking-wider text-gs-medium">Email</th>
                                          <th className="text-left px-4 py-2.5 text-xs font-black uppercase tracking-wider text-gs-medium hidden sm:table-cell">Name</th>
                                          <th className="text-left px-4 py-2.5 text-xs font-black uppercase tracking-wider text-gs-medium">Subscribed</th>
                                          <th className="px-6 py-2.5 w-20" />
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {subs.map((sub, subIdx) => (
                                          <tr
                                            key={sub.id}
                                            className={`${subIdx !== 0 ? "border-t border-gs-red/10" : ""} hover:bg-white/50 transition-colors`}
                                          >
                                            <td className="px-6 py-3 font-mono text-xs text-gs-dark">
                                              {sub.email ?? <span className="text-gs-light italic">no email</span>}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gs-medium hidden sm:table-cell">
                                              {[sub.first_name, sub.last_name].filter(Boolean).join(" ") || <span className="text-gs-light">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gs-light whitespace-nowrap">
                                              {new Date(sub.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                              <span className="ml-1 hidden sm:inline text-gs-light/70">
                                                {new Date(sub.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                              </span>
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setDeleteConfirm({ subscriberId: sub.id, email: sub.email, neighborhoodName: hood.name });
                                                }}
                                                className="text-xs font-semibold text-gs-light hover:text-red-500 border border-gs-border hover:border-red-300 rounded-lg px-2.5 py-1 transition-colors tap-none"
                                              >
                                                Delete
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Nominations ───────────────────────────────────────────────────────── */}
      {tab === "nominations" && (
        <div className="space-y-4">
          {nominations.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gs-border p-8 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="font-bold text-gs-dark">No pending nominations</p>
              <p className="text-sm text-gs-medium">Nominations submitted by residents appear here.</p>
            </div>
          ) : nominations.map((nom) => {
            const hood = neighborhoods.find((n) => n.id === nom.neighborhood_id);
            return (
              <div key={nom.id} className="bg-white rounded-3xl border border-gs-border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-gs-surface px-2 py-0.5 rounded-full font-semibold text-gs-medium">{hood?.name ?? "Unknown"}</span>
                      <span className="text-xs text-gs-light">{new Date(nom.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="font-black text-gs-dark text-lg">{nom.nominee_name}</p>
                    <p className="text-sm text-gs-medium mt-1 leading-relaxed">{nom.nominee_description}</p>
                    {nom.submitted_by_email && <p className="text-xs text-gs-light mt-2">Submitted by {nom.submitted_by_email}</p>}
                  </div>
                  <button onClick={() => selectNomination(nom.id)}
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-bold bg-gs-dark text-white rounded-xl hover:bg-gs-dark/90 transition-colors tap-none">
                    Select
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Settings ──────────────────────────────────────────────────────────── */}
      {tab === "settings" && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-gs-border p-5">
            <p className="font-black text-gs-dark mb-1">Default homepage neighborhood</p>
            <p className="text-sm text-gs-medium mb-4">Shown when someone hits gildsociety.com without a QR code context.</p>
            <div className="flex flex-wrap gap-2">
              {neighborhoods.map((hood) => (
                <button key={hood.id} onClick={() => setDefaultNeighborhood(hood.slug)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all tap-none ${defaultNeighborhoodSlug === hood.slug ? "border-gs-red bg-accent text-gs-red" : "border-gs-border text-gs-dark hover:border-gs-red/40"}`}>
                  {hood.name}{defaultNeighborhoodSlug === hood.slug && " ✓"}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gs-border p-5">
            <p className="font-black text-gs-dark mb-1">Newsletter schedule</p>
            <p className="text-sm text-gs-medium mb-2">Currently: <strong>Every Tuesday at 9am CT</strong> (auto via Vercel Cron)</p>
            <p className="text-xs text-gs-light">To change, update <code className="bg-gs-surface px-1 rounded">vercel.json</code> and redeploy. Current: <code className="bg-gs-surface px-1 rounded">0 14 * * 2</code></p>
          </div>

          <div className="bg-white rounded-3xl border border-gs-border p-5">
            <p className="font-black text-gs-dark mb-1">Add neighborhood</p>
            <p className="text-sm text-gs-medium mb-4">New neighborhoods appear in the homepage selector immediately.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {[
                { key: "name", label: "Name", placeholder: "Wildhorse Ranch" },
                { key: "slug", label: "Slug (auto)", placeholder: "wildhorse-ranch", mono: true },
                { key: "city", label: "City", placeholder: "Austin" },
                { key: "state", label: "State", placeholder: "TX", max: 2 },
              ].map(({ key, label, placeholder, mono, max }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-gs-medium uppercase tracking-wider mb-1 block">{label}</label>
                  <input type="text" placeholder={placeholder} maxLength={max}
                    value={newHood[key as keyof typeof newHood]}
                    onChange={(e) => key === "name" ? handleNameChange(e.target.value) : setNewHood((p) => ({ ...p, [key]: key === "state" ? e.target.value.toUpperCase() : e.target.value }))}
                    className={`w-full border border-gs-border rounded-xl px-3 py-2 text-sm text-gs-dark placeholder:text-gs-light focus:outline-none focus:border-gs-red transition-colors ${mono ? "font-mono" : ""} ${key === "state" ? "uppercase" : ""}`}
                  />
                </div>
              ))}
            </div>
            {hoodError && <p className="text-xs text-red-600 font-semibold mb-3">⚠️ {hoodError}</p>}
            <button onClick={createNeighborhood} disabled={creatingHood}
              className="px-5 py-2 bg-gs-red text-white text-sm font-bold rounded-xl hover:bg-gs-red/90 transition-colors disabled:opacity-50 tap-none">
              {creatingHood ? "Creating…" : "Create neighborhood →"}
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-gs-border p-5">
            <p className="font-black text-gs-dark mb-1">Manage neighborhoods</p>
            <p className="text-sm text-gs-medium mb-4">Edit details, toggle active status, and manage ZIP codes.</p>
            <div className="space-y-3">
              {neighborhoods.length === 0 ? (
                <p className="text-sm text-gs-medium py-4 text-center">No neighborhoods yet.</p>
              ) : neighborhoods.map((hood) => (
                <div key={hood.id} className="border border-gs-border rounded-2xl overflow-hidden">
                  {editingId === hood.id ? (
                    <div className="p-4 space-y-3">
                      <p className="text-xs font-bold text-gs-medium uppercase tracking-wider">Editing {hood.name}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { field: "name", label: "Name" },
                          { field: "city", label: "City" },
                          { field: "state", label: "State", max: 2, upper: true },
                        ].map(({ field, label, max, upper }) => (
                          <div key={field}>
                            <label className="text-xs font-semibold text-gs-medium uppercase tracking-wider mb-1 block">{label}</label>
                            <input type="text" maxLength={max}
                              value={editForm[field as keyof typeof editForm] as string}
                              onChange={(e) => setEditForm((p) => ({ ...p, [field]: upper ? e.target.value.toUpperCase() : e.target.value }))}
                              className={`w-full border border-gs-border rounded-xl px-3 py-2 text-sm text-gs-dark focus:outline-none focus:border-gs-red transition-colors ${upper ? "uppercase" : ""}`}
                            />
                          </div>
                        ))}
                        <div className="flex items-center gap-3 pt-5">
                          <button onClick={() => setEditForm((p) => ({ ...p, active: !p.active }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.active ? "bg-green-500" : "bg-gs-border"}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${editForm.active ? "translate-x-6" : "translate-x-1"}`} />
                          </button>
                          <span className="text-sm font-semibold text-gs-dark">{editForm.active ? "Active" : "Inactive"}</span>
                        </div>
                      </div>
                      {editError && <p className="text-xs text-red-600 font-semibold">⚠️ {editError}</p>}
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(hood.id)} disabled={savingEdit}
                          className="px-4 py-2 bg-gs-red text-white text-xs font-bold rounded-xl hover:bg-gs-red/90 disabled:opacity-50 tap-none">
                          {savingEdit ? "Saving…" : "Save"}
                        </button>
                        <button onClick={cancelEdit} className="px-4 py-2 border border-gs-border text-xs font-semibold text-gs-dark rounded-xl hover:border-gs-dark tap-none">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-semibold text-gs-dark text-sm">{hood.name}</p>
                        <p className="text-xs text-gs-medium">{hood.city}, {hood.state} · {subCount(hood.id)} subscribers</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${hood.active ? "bg-green-100 text-green-700" : "bg-gs-surface text-gs-medium"}`}>{hood.active ? "Active" : "Inactive"}</span>
                        <button onClick={() => startEdit(hood)} className="text-xs font-semibold text-gs-medium hover:text-gs-dark border border-gs-border rounded-lg px-2.5 py-1 transition-colors tap-none">Edit</button>
                      </div>
                    </div>
                  )}
                  <div className="border-t border-gs-border">
                    <button onClick={() => toggleZips(hood.id)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-gs-medium hover:text-gs-dark hover:bg-gs-surface transition-colors tap-none">
                      <span>ZIP codes {zipsByHood[hood.id] ? `(${zipsByHood[hood.id].length})` : ""}</span>
                      <span className="text-gs-light">{expandedZips === hood.id ? "▲ collapse" : "▼ manage"}</span>
                    </button>
                    {expandedZips === hood.id && (
                      <div className="px-4 pb-4 space-y-3">
                        {loadingZips === hood.id ? <p className="text-xs text-gs-medium py-2">Loading…</p> : (
                          <>
                            {(zipsByHood[hood.id] ?? []).length === 0
                              ? <p className="text-xs text-gs-medium py-1">No ZIP codes yet.</p>
                              : <div className="flex flex-wrap gap-1.5">
                                  {(zipsByHood[hood.id] ?? []).map((z) => (
                                    <span key={z.id} className="inline-flex items-center gap-1 bg-gs-surface border border-gs-border rounded-lg px-2.5 py-1 text-xs font-mono font-semibold text-gs-dark">
                                      {z.zip_code}
                                      <button onClick={() => removeZip(hood.id, z.id, z.zip_code)} className="text-gs-light hover:text-red-500 transition-colors tap-none">×</button>
                                    </span>
                                  ))}
                                </div>
                            }
                            <div className="flex gap-2 items-center">
                              <input type="text" inputMode="numeric" placeholder="78660" value={newZip} maxLength={5}
                                onChange={(e) => { setNewZip(e.target.value.replace(/\D/g, "").slice(0, 5)); setZipError(null); }}
                                onKeyDown={(e) => { if (e.key === "Enter" && newZip.length === 5) void addZip(hood.id); }}
                                className="w-28 border border-gs-border rounded-xl px-3 py-1.5 text-sm font-mono text-gs-dark focus:outline-none focus:border-gs-red transition-colors" />
                              <button onClick={() => void addZip(hood.id)} disabled={addingZip || newZip.length !== 5}
                                className="px-3 py-1.5 bg-gs-dark text-white text-xs font-bold rounded-xl hover:bg-gs-dark/90 disabled:opacity-40 tap-none">
                                {addingZip ? "Adding…" : "+ Add"}
                              </button>
                            </div>
                            {zipError && <p className="text-xs text-red-600 font-semibold">⚠️ {zipError}</p>}
                            <p className="text-xs text-gs-light">Users who enter a ZIP from this list are auto-matched to <strong className="text-gs-medium">{hood.name}</strong>.</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gs-dark text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl z-50 whitespace-nowrap">{toast}</div>
      )}

      {/* Delete subscriber confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !deletingId && setDeleteConfirm(null)}>
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
              <span className="text-2xl">🗑️</span>
            </div>
            <p className="font-black text-gs-dark text-lg mb-1">Remove subscriber?</p>
            <p className="text-sm text-gs-medium mb-1">
              <span className="font-semibold text-gs-dark font-mono">{deleteConfirm.email ?? "This subscriber"}</span> will be removed from{" "}
              <span className="font-semibold text-gs-dark">{deleteConfirm.neighborhoodName}</span>.
            </p>
            <p className="text-xs text-gs-light mb-6">They can re-sign up at any time using the same email.</p>
            <div className="flex gap-3">
              <button
                onClick={() => void confirmDeleteSubscriber()}
                disabled={!!deletingId}
                className="flex-1 py-2.5 bg-gs-red text-white text-sm font-bold rounded-xl hover:bg-gs-red/90 transition-colors disabled:opacity-50 tap-none"
              >
                {deletingId ? "Removing…" : "Yes, remove"}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={!!deletingId}
                className="flex-1 py-2.5 border border-gs-border text-sm font-semibold text-gs-dark rounded-xl hover:border-gs-dark transition-colors disabled:opacity-40 tap-none"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {previewIssue && (
        <NewsletterPreviewModal
          issue={previewIssue}
          neighborhoodName={neighborhoods.find((n) => n.id === previewIssue.neighborhood_id)?.name}
          onClose={() => setPreviewIssue(null)}
          onSaved={(updated) => {
            setPreviewIssue(updated);
            setLocalIssues((prev) =>
              prev.map((i) => (i.id === updated.id ? updated : i))
            );
          }}
        />
      )}
    </div>
  );
}

// ── Topic Picker Panel ────────────────────────────────────────────────────────
function TopicPickerPanel({
  hood,
  loading,
  articles,
  error,
  selectedUrls,
  onToggle,
  onSelectAll,
  onClearAll,
  showAdvanced,
  onToggleAdvanced,
  advanced,
  onAdvancedChange,
  generating,
  onGenerate,
  onCancel,
}: {
  hood: { name: string; slug: string };
  loading: boolean;
  articles: ScrapedArticle[];
  error: string | null;
  selectedUrls: Set<string>;
  onToggle: (url: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  advanced: AdvancedSeeds;
  onAdvancedChange: (a: AdvancedSeeds) => void;
  generating: boolean;
  onGenerate: () => void;
  onCancel: () => void;
}) {
  const selectedCount = selectedUrls.size;

  return (
    <div className="border border-gs-red/20 rounded-2xl bg-accent overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gs-red/10">
        <p className="font-black text-gs-dark text-sm">{hood.name} — pick your topics</p>
        <button onClick={onCancel} className="text-xs text-gs-medium hover:text-gs-dark tap-none">Cancel</button>
      </div>

      {/* Article list */}
      <div className="p-4">
        {loading && (
          <div className="flex items-center gap-2 py-8 justify-center">
            <Spinner className="text-gs-red" />
            <span className="text-sm text-gs-medium">Searching this week&apos;s news…</span>
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-red-600 font-semibold py-4 text-center">⚠️ {error}</p>
        )}

        {!loading && !error && articles.length === 0 && (
          <p className="text-sm text-gs-medium py-4 text-center">No articles found. Add context in the fields below.</p>
        )}

        {!loading && articles.length > 0 && (
          <>
            {/* Selection controls */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gs-medium">
                {articles.length} articles found
                {selectedCount > 0 && <span className="ml-2 font-bold text-gs-dark">{selectedCount} selected</span>}
              </p>
              <div className="flex gap-2">
                <button onClick={onSelectAll} className="text-xs font-semibold text-gs-medium hover:text-gs-dark tap-none">Select all</button>
                {selectedCount > 0 && (
                  <button onClick={onClearAll} className="text-xs font-semibold text-gs-medium hover:text-gs-dark tap-none">Clear</button>
                )}
              </div>
            </div>

            {/* Article cards */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {articles.map((article) => {
                const selected = selectedUrls.has(article.url);
                const daysAgo = Math.floor(
                  (Date.now() - new Date(article.publishedAt).getTime()) / (1000 * 60 * 60 * 24)
                );
                const age = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`;

                return (
                  <button
                    key={article.url}
                    onClick={() => onToggle(article.url)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all tap-none ${
                      selected
                        ? "border-gs-red bg-white"
                        : "border-gs-border bg-white hover:border-gs-red/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <div className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        selected ? "border-gs-red bg-gs-red" : "border-gs-border"
                      }`}>
                        {selected && (
                          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold leading-snug mb-1 ${selected ? "text-gs-dark" : "text-gs-dark"}`}>
                          {article.headline}
                        </p>
                        <p className="text-xs text-gs-medium leading-relaxed line-clamp-2">{article.description}</p>
                        <p className="text-xs text-gs-light mt-1">{article.source} · {age}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Advanced options (collapsed) */}
      <div className="border-t border-gs-red/10">
        <button onClick={onToggleAdvanced}
          className="w-full flex items-center justify-between px-5 py-3 text-xs font-semibold text-gs-medium hover:text-gs-dark transition-colors tap-none">
          <span>Advanced options — poll, business spotlight, DIY tip, local notes</span>
          <span>{showAdvanced ? "▲ hide" : "▼ show"}</span>
        </button>

        {showAdvanced && (
          <div className="px-5 pb-5 space-y-4">
            {/* Local notes */}
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-gs-dark block mb-1">Anything NewsAPI missed</label>
              <p className="text-xs text-gs-medium mb-1.5">HOA updates, local events, things you heard from a neighbor</p>
              <textarea rows={3} placeholder="e.g. The pool is closed for maintenance through Sept 14. New stop sign at Prairieview and Creek Bend."
                value={advanced.localNotes}
                onChange={(e) => onAdvancedChange({ ...advanced, localNotes: e.target.value })}
                className="w-full border border-gs-border rounded-xl px-3 py-2 text-sm text-gs-dark placeholder:text-gs-light focus:outline-none focus:border-gs-red transition-colors resize-none bg-white" />
            </div>

            {/* Check-in */}
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-gs-dark block mb-1">Neighborhood Check-in</label>
              <p className="text-xs text-gs-medium mb-1.5">Poll question or topic — Claude writes the 4 options</p>
              <input type="text" placeholder="e.g. Should Wildhorse push for more street lights on the main loop?"
                value={advanced.checkinSeed}
                onChange={(e) => onAdvancedChange({ ...advanced, checkinSeed: e.target.value })}
                className="w-full border border-gs-border rounded-xl px-3 py-2 text-sm text-gs-dark placeholder:text-gs-light focus:outline-none focus:border-gs-red transition-colors bg-white" />
            </div>

            {/* Business spotlight */}
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-gs-dark block mb-1">Business Spotlight</label>
              <p className="text-xs text-gs-medium mb-1.5">Leave blank to skip — this section only runs if you seed it</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="text" placeholder="Business name" value={advanced.businessName}
                  onChange={(e) => onAdvancedChange({ ...advanced, businessName: e.target.value })}
                  className="border border-gs-border rounded-xl px-3 py-2 text-sm text-gs-dark placeholder:text-gs-light focus:outline-none focus:border-gs-red transition-colors bg-white" />
                <input type="text" placeholder="Location / address" value={advanced.businessLocation}
                  onChange={(e) => onAdvancedChange({ ...advanced, businessLocation: e.target.value })}
                  className="border border-gs-border rounded-xl px-3 py-2 text-sm text-gs-dark placeholder:text-gs-light focus:outline-none focus:border-gs-red transition-colors bg-white" />
                <textarea rows={2} placeholder="What they do (2 sentences max)" value={advanced.businessDescription}
                  onChange={(e) => onAdvancedChange({ ...advanced, businessDescription: e.target.value })}
                  className="sm:col-span-2 border border-gs-border rounded-xl px-3 py-2 text-sm text-gs-dark placeholder:text-gs-light focus:outline-none focus:border-gs-red transition-colors resize-none bg-white" />
              </div>
            </div>

            {/* DIY tip */}
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-gs-dark block mb-1">DIY Tip</label>
              <input type="text" placeholder="Topic or full tip — e.g. Prep your AC before July hits"
                value={advanced.diyTipSeed}
                onChange={(e) => onAdvancedChange({ ...advanced, diyTipSeed: e.target.value })}
                className="w-full border border-gs-border rounded-xl px-3 py-2 text-sm text-gs-dark placeholder:text-gs-light focus:outline-none focus:border-gs-red transition-colors bg-white" />
            </div>

            {/* Fun fact */}
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-gs-dark block mb-1">Fun Fact</label>
              <input type="text" placeholder="Specific fact, or leave blank for Claude to pick"
                value={advanced.funFactSeed}
                onChange={(e) => onAdvancedChange({ ...advanced, funFactSeed: e.target.value })}
                className="w-full border border-gs-border rounded-xl px-3 py-2 text-sm text-gs-dark placeholder:text-gs-light focus:outline-none focus:border-gs-red transition-colors bg-white" />
            </div>
          </div>
        )}
      </div>

      {/* Generate button */}
      <div className="flex items-center gap-3 px-5 py-4 border-t border-gs-red/10">
        <button onClick={onGenerate} disabled={generating || (selectedCount === 0 && !advanced.localNotes.trim())}
          className="flex items-center gap-2 px-5 py-2.5 bg-gs-red text-white text-sm font-bold rounded-xl hover:bg-gs-red/90 transition-colors disabled:opacity-40 tap-none">
          {generating ? <><Spinner className="text-white" />Generating…</> : "Generate newsletter →"}
        </button>
        {selectedCount > 0 && (
          <p className="text-xs text-gs-medium">{selectedCount} article{selectedCount !== 1 ? "s" : ""} selected</p>
        )}
        {selectedCount === 0 && !advanced.localNotes.trim() && !loading && (
          <p className="text-xs text-gs-light">Select at least one article to generate</p>
        )}
      </div>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────
function Spinner({ className = "text-gs-red" }: { className?: string }) {
  return (
    <span className={`inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`} />
  );
}

function StatCard({ label, value, color, onClick }: { label: string; value: number; color?: "red"; onClick?: () => void }) {
  const base = "bg-white rounded-2xl border border-gs-border p-4 transition-all";
  const interactive = onClick ? "cursor-pointer hover:border-gs-red/40 hover:shadow-sm active:scale-[0.98]" : "";
  return (
    <div className={`${base} ${interactive}`} onClick={onClick}>
      <p className={`text-2xl font-black mb-0.5 ${color === "red" && value > 0 ? "text-gs-red" : "text-gs-dark"}`}>{value}</p>
      <p className="text-xs text-gs-medium">{label}</p>
      {onClick && <p className="text-xs text-gs-light mt-1">tap to view →</p>}
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
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}
