/**
 * Newsletter generation endpoint
 *
 * GET  — Vercel Cron (runs every Tuesday 9am CT / 14:00 UTC)
 *         Auth: Authorization: Bearer CRON_SECRET
 *         Query: ?neighborhood=<slug>  (optional — generates all active if omitted)
 *
 * POST — Admin manual trigger with optional seed data
 *         Auth: admin_token cookie
 *         Body: { neighborhood?: string; seeds?: NewsletterSeeds }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { scrapeNeighborhoodNews, searchForSeedTopic, type ScrapedArticle } from "@/lib/scraper";
import { generateNewsletter, type NewsletterSeeds } from "@/lib/claude";
import { renderNewsletterHtml } from "@/lib/email-template";

export const maxDuration = 60;

// ── Core generation logic ─────────────────────────────────────────────────────
async function runGeneration(
  onlySlug?: string | null,
  seeds?: NewsletterSeeds,
  /** Articles the admin hand-picked from topic search. When present, skip auto seed search. */
  selectedArticles?: ScrapedArticle[]
) {
  const supabase = createServiceClient();

  const query = supabase.from("neighborhoods").select("*").eq("active", true);
  if (onlySlug) query.eq("slug", onlySlug);

  const { data: neighborhoods, error } = await query;
  if (error || !neighborhoods?.length) {
    return { error: "No neighborhoods found", status: 404 };
  }

  const results: Array<{
    neighborhood: string;
    status: "success" | "error";
    issueId?: string;
    error?: string;
    draft?: {
      id: string;
      neighborhood_id: string;
      subject: string;
      preview_text: string | null;
      content_json: unknown;
      status: string;
      created_at: string;
      sent_at: string | null;
      neighborhoods: { name: string; slug: string };
    };
  }> = [];

  for (const hood of neighborhoods) {
    try {
      console.log(`Generating newsletter for ${hood.name}…`);

      // 1. General neighborhood news scrape (always runs)
      const articles = await scrapeNeighborhoodNews(hood.name, hood.city, hood.state);
      console.log(`  → Scraped ${articles.length} general articles`);

      // 2. Seed articles — either admin hand-picked OR auto-searched from seed text
      let seedArticles: ScrapedArticle[];

      if (selectedArticles && selectedArticles.length > 0) {
        // Admin picked articles from the topic picker — use them directly, no extra search
        seedArticles = selectedArticles;
        console.log(`  → Using ${seedArticles.length} admin-selected articles`);
      } else {
        // Fall back to targeted seed searches when no articles were hand-picked
        const seedSearches: Promise<ScrapedArticle[]>[] = [];
        if (seeds?.hookSeed?.trim()) {
          console.log(`  → Searching NewsAPI for hook: "${seeds.hookSeed.slice(0, 60)}…"`);
          seedSearches.push(searchForSeedTopic(seeds.hookSeed));
        }
        if (seeds?.localNewsSeed?.trim()) {
          seedSearches.push(searchForSeedTopic(seeds.localNewsSeed));
        }
        if (seeds?.cityNewsSeed?.trim()) {
          seedSearches.push(searchForSeedTopic(seeds.cityNewsSeed));
        }
        const seedResults = await Promise.all(seedSearches);
        seedArticles = Array.from(
          new Map(seedResults.flat().map((a) => [a.url, a])).values()
        );
        console.log(`  → Found ${seedArticles.length} seed-specific articles`);
      }

      // 3. Generate with Claude (seed articles go first so they get priority)
      const output = await generateNewsletter({
        neighborhoodName: hood.name,
        city: hood.city,
        state: hood.state,
        articles,
        seedArticles,
        seeds: seeds ?? {},
      });
      console.log(`  → Generated: "${output.subject}"`);

      // 4. Render HTML email
      const htmlBody = renderNewsletterHtml({
        neighborhoodName: hood.name,
        city: hood.city,
        state: hood.state,
        subject: output.subject,
        content: output.content,
      });

      // 5. Save draft
      const { data: issue, error: saveError } = await supabase
        .from("newsletter_issues")
        .insert([
          {
            neighborhood_id: hood.id,
            subject: output.subject,
            preview_text: output.preview_text,
            content_json: output.content as unknown as import("@/types/database").Json,
            html_body: htmlBody,
            status: "draft",
          },
        ])
        .select("id, neighborhood_id, subject, preview_text, content_json, status, created_at, sent_at")
        .single();

      if (saveError) throw saveError;

      results.push({
        neighborhood: hood.name,
        status: "success",
        issueId: issue.id,
        draft: {
          id: issue.id,
          neighborhood_id: issue.neighborhood_id,
          subject: issue.subject,
          preview_text: issue.preview_text,
          content_json: issue.content_json,
          status: issue.status,
          created_at: issue.created_at,
          sent_at: issue.sent_at,
          neighborhoods: { name: hood.name, slug: hood.slug },
        },
      });
    } catch (err) {
      console.error(`Error generating for ${hood.name}:`, err);
      results.push({
        neighborhood: hood.name,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return { results };
}

// ── GET — Vercel Cron ─────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const adminToken = request.cookies.get("admin_token")?.value;
  const isAdmin = adminToken === process.env.ADMIN_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const onlySlug = request.nextUrl.searchParams.get("neighborhood");
  const result = await runGeneration(onlySlug);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}

// ── POST — Admin manual trigger with seeds ────────────────────────────────────
export async function POST(request: NextRequest) {
  const adminToken = request.cookies.get("admin_token")?.value;
  if (adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    neighborhood?: string;
    seeds?: NewsletterSeeds;
    // Articles the admin hand-picked from the topic search — skip the auto seed search
    selectedArticles?: ScrapedArticle[];
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // No body is fine — generate without seeds
  }

  const result = await runGeneration(
    body.neighborhood ?? null,
    body.seeds,
    body.selectedArticles
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
