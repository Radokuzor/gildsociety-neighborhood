/**
 * News scraper — fetches articles for a neighborhood using NewsAPI.org
 * Free tier: 100 requests/day (plenty for weekly newsletters)
 * Sign up at: https://newsapi.org
 */

export interface ScrapedArticle {
  headline: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
}

/**
 * Fetch recent news articles for a given neighborhood + city
 */
export async function scrapeNeighborhoodNews(
  neighborhoodName: string,
  city: string,
  state: string,
  maxArticles = 8
): Promise<ScrapedArticle[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) throw new Error("NEWS_API_KEY is not set");

  // Build a focused search query
  // e.g. "Wildhorse Ranch" OR "Pflugerville" Austin Texas
  const query = encodeURIComponent(
    `"${neighborhoodName}" OR "${city}" ${state} neighborhood community`
  );

  const url =
    `https://newsapi.org/v2/everything` +
    `?q=${query}` +
    `&language=en` +
    `&sortBy=publishedAt` +
    `&pageSize=${maxArticles}` +
    `&apiKey=${apiKey}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "GildSociety/1.0" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NewsAPI error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    status: string;
    articles: Array<{
      title: string;
      description: string | null;
      url: string;
      source: { name: string };
      publishedAt: string;
    }>;
  };

  if (data.status !== "ok") {
    throw new Error(`NewsAPI returned status: ${data.status}`);
  }

  return data.articles
    .filter(
      (a) =>
        a.title &&
        a.description &&
        !a.title.includes("[Removed]") &&
        a.url
    )
    .slice(0, maxArticles)
    .map((a) => ({
      headline: a.title,
      description: a.description ?? "",
      url: a.url,
      source: a.source.name,
      publishedAt: a.publishedAt,
    }));
}

/**
 * Search NewsAPI for a specific topic seeded by the admin.
 * Used to pull real details (dates, locations, outcomes) about events
 * the admin mentioned in the hook or local news seed fields.
 *
 * Pass the raw seed text — we clean it and use it as the query.
 */
export async function searchForSeedTopic(
  seedText: string,
  maxArticles = 6
): Promise<ScrapedArticle[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return [];

  // Strip placeholder words, keep the meaningful nouns/phrases
  // Trim to 120 chars so NewsAPI doesn't choke on it
  const cleaned = seedText
    .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|near|just|some|this|that|was|were|has|have|is|are)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  const query = encodeURIComponent(cleaned);
  const url =
    `https://newsapi.org/v2/everything` +
    `?q=${query}` +
    `&language=en` +
    `&sortBy=publishedAt` +
    `&pageSize=${maxArticles}` +
    `&apiKey=${apiKey}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "GildSociety/1.0" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      status: string;
      articles: Array<{
        title: string;
        description: string | null;
        url: string;
        source: { name: string };
        publishedAt: string;
      }>;
    };

    if (data.status !== "ok") return [];

    return data.articles
      .filter((a) => a.title && a.description && !a.title.includes("[Removed]") && a.url)
      .slice(0, maxArticles)
      .map((a) => ({
        headline: a.title,
        description: a.description ?? "",
        url: a.url,
        source: a.source.name,
        publishedAt: a.publishedAt,
      }));
  } catch {
    return [];
  }
}

/**
 * Search Google News RSS for a query — no API key required.
 * Returns results from local TV stations, newspapers, and community sites
 * that NewsAPI often misses for hyper-local searches.
 *
 * Note: URLs come back as Google redirect links (standard behavior for Google News).
 */
export async function searchGoogleNews(
  query: string,
  maxArticles = 8
): Promise<ScrapedArticle[]> {
  const url =
    `https://news.google.com/rss/search` +
    `?q=${encodeURIComponent(query)}` +
    `&hl=en-US&gl=US&ceid=US:en`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GildSociety/1.0; +https://gildsociety.com)",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    return parseGoogleNewsRss(xml).slice(0, maxArticles);
  } catch {
    return [];
  }
}

/**
 * Parse a Google News RSS XML string into ScrapedArticle[].
 * Google News title format: "Headline text - Source Name"
 */
function parseGoogleNewsRss(xml: string): ScrapedArticle[] {
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];

  return items
    .map((item): ScrapedArticle | null => {
      // Title — may be wrapped in CDATA
      const titleRaw =
        item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ??
        item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ??
        "";

      // Google News format: "Headline - Source Name"
      // Split on last " - " to separate source from headline
      const lastDash = titleRaw.lastIndexOf(" - ");
      const headline = lastDash > 0 ? titleRaw.slice(0, lastDash).trim() : titleRaw.trim();
      const sourceFromTitle = lastDash > 0 ? titleRaw.slice(lastDash + 3).trim() : "";

      // <source> tag (more reliable than parsing from title)
      const sourceTag =
        item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim() ?? "";
      const source = sourceTag || sourceFromTitle || "Google News";

      // Link — Google News uses <link> as a GUID-style URL
      const linkRaw =
        item.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ??
        item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim() ??
        "";

      // Description — strip HTML tags if present
      const descRaw =
        item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ??
        item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ??
        "";
      const description = descRaw.replace(/<[^>]+>/g, "").trim();

      // pubDate
      const pubDateRaw =
        item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";
      const publishedAt = pubDateRaw
        ? new Date(pubDateRaw).toISOString()
        : new Date().toISOString();

      if (!headline || !linkRaw) return null;

      return { headline, description, url: linkRaw, source, publishedAt };
    })
    .filter((a): a is ScrapedArticle => a !== null);
}

/**
 * Fetch general interest content (used for DIY tips, fun facts)
 * Not neighborhood-specific — same for all newsletters that week
 */
export async function scrapeGeneralNews(
  topic: string,
  maxArticles = 5
): Promise<ScrapedArticle[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) throw new Error("NEWS_API_KEY is not set");

  const query = encodeURIComponent(topic);
  const url =
    `https://newsapi.org/v2/everything` +
    `?q=${query}` +
    `&language=en` +
    `&sortBy=relevancy` +
    `&pageSize=${maxArticles}` +
    `&apiKey=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    status: string;
    articles: Array<{
      title: string;
      description: string | null;
      url: string;
      source: { name: string };
      publishedAt: string;
    }>;
  };

  return (data.articles ?? [])
    .filter((a) => a.title && a.description && !a.title.includes("[Removed]"))
    .slice(0, maxArticles)
    .map((a) => ({
      headline: a.title,
      description: a.description ?? "",
      url: a.url,
      source: a.source.name,
      publishedAt: a.publishedAt,
    }));
}
