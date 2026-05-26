/**
 * Topic search — finds recent news articles for a neighborhood before generation.
 * Admin browses results and picks what to write about, then triggers generation.
 *
 * GET /api/admin/topic-search?neighborhood=<slug>
 *
 * Sources (run in parallel, merged + deduplicated):
 *   NewsAPI  — 4 targeted queries (neighborhood, safety, development, general)
 *   Google News RSS — 3 queries (no API key required, broader local coverage)
 *
 * Returns up to 30 deduplicated articles sorted newest first.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { searchGoogleNews } from "@/lib/scraper";
import type { ScrapedArticle } from "@/lib/scraper";

export async function GET(request: NextRequest) {
  const adminToken = request.cookies.get("admin_token")?.value;
  if (adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = request.nextUrl.searchParams.get("neighborhood");
  if (!slug) {
    return NextResponse.json({ error: "neighborhood param required" }, { status: 400 });
  }

  // Look up the neighborhood
  const supabase = createServiceClient();
  const { data: hood, error } = await supabase
    .from("neighborhoods")
    .select("name, city, state")
    .eq("slug", slug)
    .single();

  if (error || !hood) {
    return NextResponse.json({ error: "Neighborhood not found" }, { status: 404 });
  }

  const { name: neighborhoodName, city, state } = hood;
  const apiKey = process.env.NEWS_API_KEY;

  // ── NewsAPI searches (if key is configured) ───────────────────────────────
  const newsApiQueries = [
    `"${neighborhoodName}" OR "${city}" ${state}`,
    `"${city}" ${state} police OR shooting OR crime OR safety OR arrest`,
    `"${city}" ${state} school OR development OR construction OR traffic OR road`,
    `"${city}" ${state} news`,
  ];

  const fetchNewsApi = async (q: string): Promise<ScrapedArticle[]> => {
    if (!apiKey) return [];
    const url =
      `https://newsapi.org/v2/everything` +
      `?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=8&apiKey=${apiKey}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "GildSociety/1.0" },
        next: { revalidate: 0 },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        status: string;
        articles: Array<{
          title: string; description: string | null;
          url: string; source: { name: string }; publishedAt: string;
        }>;
      };
      if (data.status !== "ok") return [];
      return data.articles
        .filter((a) => a.title && a.description && !a.title.includes("[Removed]") && a.url)
        .map((a) => ({
          headline: a.title,
          description: a.description ?? "",
          url: a.url,
          source: a.source.name,
          publishedAt: a.publishedAt,
        }));
    } catch { return []; }
  };

  // ── Google News RSS searches (no API key needed) ──────────────────────────
  // Broader queries work better on Google News than on NewsAPI for local topics
  const googleQueries = [
    `${neighborhoodName} ${city} ${state}`,
    `${city} ${state} police crime safety`,
    `${city} ${state} community news`,
  ];

  // Run everything in parallel — NewsAPI + Google News simultaneously
  const [newsApiResults, googleResults] = await Promise.all([
    Promise.all(newsApiQueries.map(fetchNewsApi)),
    Promise.all(googleQueries.map((q) => searchGoogleNews(q, 8))),
  ]);

  // ── Merge + deduplicate by URL, sort newest first ─────────────────────────
  const allBatches = [...newsApiResults, ...googleResults];
  const seen = new Set<string>();
  const articles: ScrapedArticle[] = [];

  for (const batch of allBatches) {
    for (const article of batch) {
      if (article.url && !seen.has(article.url)) {
        seen.add(article.url);
        articles.push(article);
      }
    }
  }

  articles.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return NextResponse.json({
    articles: articles.slice(0, 30),
    neighborhood: { name: neighborhoodName, city, state },
    sources: {
      newsapi: !!apiKey,
      googleNews: true,
    },
  });
}
