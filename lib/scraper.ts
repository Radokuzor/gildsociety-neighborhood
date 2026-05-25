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
