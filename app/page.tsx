import { createClient } from "@/lib/supabase/server";
import ArticlePageClient from "@/components/home/ArticlePageClient";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

type Neighborhood = Database["public"]["Tables"]["neighborhoods"]["Row"];
type NewsletterIssue = Database["public"]["Tables"]["newsletter_issues"]["Row"];

export interface HomePageData {
  defaultNeighborhood: Neighborhood;
  allNeighborhoods: Neighborhood[];
  featuredIssue: NewsletterIssue | null;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string; show?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

  // ── 1. Find the default neighborhood (admin-set or query param override) ──
  let targetSlug: string | null = params.n ?? null;

  if (!targetSlug) {
    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "default_neighborhood_slug")
      .single();
    targetSlug = setting?.value ?? "wildhorse-ranch";
  }

  // ── 2. Load all active neighborhoods (for the selector dropdown) ──────────
  const { data: allNeighborhoods } = await supabase
    .from("neighborhoods")
    .select("*")
    .eq("active", true)
    .order("name");

  // ── 3. Load the target neighborhood + its featured issue ──────────────────
  const { data: neighborhood } = await supabase
    .from("neighborhoods")
    .select("*")
    .eq("slug", targetSlug)
    .eq("active", true)
    .single();

  // Fallback: first active neighborhood
  const defaultNeighborhood =
    neighborhood ?? (allNeighborhoods ?? [])[0] ?? null;

  if (!defaultNeighborhood) {
    // No neighborhoods configured yet
    return (
      <div className="min-h-screen-safe flex items-center justify-center">
        <p className="text-gs-medium">Coming soon to your neighborhood.</p>
      </div>
    );
  }

  // ── 4. Load the featured (pinned) issue for this neighborhood ─────────────
  let featuredIssue: NewsletterIssue | null = null;

  if (defaultNeighborhood.featured_issue_id) {
    const { data } = await supabase
      .from("newsletter_issues")
      .select("*")
      .eq("id", defaultNeighborhood.featured_issue_id)
      .single();
    featuredIssue = data;
  } else {
    // Fallback: most recent sent issue
    const { data } = await supabase
      .from("newsletter_issues")
      .select("*")
      .eq("neighborhood_id", defaultNeighborhood.id)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .single();
    featuredIssue = data;
  }

  // ── 5. Check if user is already logged in ─────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <ArticlePageClient
      defaultNeighborhood={defaultNeighborhood}
      allNeighborhoods={allNeighborhoods ?? []}
      featuredIssue={featuredIssue}
      isLoggedIn={!!user}
      showOnboarding={params.show === "onboarding"}
    />
  );
}
