import { redirect } from "next/navigation";
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
  searchParams: Promise<{ n?: string; show?: string; code?: string }>;
}) {
  const params = await searchParams;

  // Supabase sometimes sends the magic-link code to the Site URL (this page)
  // instead of /auth/callback when the redirect URL isn't in the allowlist.
  // Catch it here and forward to the callback so the session is established.
  if (params.code) {
    redirect(`/auth/callback?code=${params.code}&next=/`);
  }

  const supabase = await createClient();

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

  // ── 6. If logged in and returning from magic link, check onboarding status ─
  // Show the overlay only when the subscriber record is missing or incomplete.
  // Only select columns that are guaranteed to exist (first_name, address) —
  // last_name may not exist yet if migration 003 hasn't been applied.
  let needsOnboarding = false;
  if (user && params.show === "onboarding") {
    const { data: subscriber, error: subQueryError } = await supabase
      .from("subscribers")
      .select("first_name, address")
      .eq("user_id", user.id)
      .single();

    if (subQueryError && subQueryError.code !== "PGRST116") {
      // PGRST116 = "no rows" — that's expected and means onboarding is needed.
      // Any other error: treat as "needs onboarding" (safe default).
      needsOnboarding = true;
    } else {
      // Needs onboarding if no record at all, or name/address haven't been filled in
      const isComplete =
        subscriber &&
        subscriber.first_name?.trim() &&
        subscriber.address?.trim();
      needsOnboarding = !isComplete;
    }
  }

  return (
    <ArticlePageClient
      defaultNeighborhood={defaultNeighborhood}
      allNeighborhoods={allNeighborhoods ?? []}
      featuredIssue={featuredIssue}
      isLoggedIn={!!user}
      showOnboarding={needsOnboarding}
    />
  );
}
