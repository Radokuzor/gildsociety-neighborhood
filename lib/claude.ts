/**
 * Claude newsletter generation.
 * Voice is defined in lib/newsletter-voice.ts — edit that file to tune the tone.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ScrapedArticle } from "./scraper";
import { buildSystemPrompt } from "./newsletter-voice";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Content shape ─────────────────────────────────────────────────────────────
export interface NewsletterContent {
  /**
   * Hook line — rendered inside the email header, right below the date.
   * Replaces the generic greeting. One sentence: a direct question or statement
   * that makes a neighbor stop and read. Sounds like a neighbor wrote it, not a brand.
   * E.g. "Did anyone else on the block get woken up by that helicopter Thursday night?"
   */
  opening: string;

  /**
   * 2-3 neighborhood-level news items. Each has its own headline — no wrapper label
   * is shown in the email. These are the meat of the newsletter.
   */
  local_news: Array<{
    headline: string;
    body: string; // 2-3 sentences, specific and human
  }>;

  /**
   * One city-level story that connects back to the neighborhood.
   */
  city_connection: {
    headline: string;
    body: string;
  };

  /**
   * Community poll — a question residents can vote on.
   * 4 conversational answer options.
   */
  neighborhood_checkin: {
    question: string;
    options: string[]; // exactly 4 options, no emojis
  };

  /**
   * Only present if admin seeded it. Null = section is skipped entirely.
   * Max 2 sentences: what they do + why a neighbor would care.
   */
  business_spotlight: {
    name: string;
    description: string; // 2 sentences max
    location: string;
  } | null;

  /**
   * Practical home/seasonal tip. Max 4 sentences.
   */
  diy_tip: {
    title: string; // action-oriented, no emojis
    body: string;  // max 4 sentences
  };

  /**
   * One surprising or delightful fact. 1-2 sentences.
   */
  fun_fact: string;
}

// ── Admin seeds (all optional) ────────────────────────────────────────────────
export interface NewsletterSeeds {
  adminNotes?: string;
  hookSeed?: string;        // Safety events, big local moments — used for opening + search
  localNewsSeed?: string;   // Neighborhood stories to include
  cityNewsSeed?: string;    // City-level story to connect
  checkinSeed?: string;     // Poll question or topic
  businessSpotlightSeed?: {
    name: string;
    description: string;
    location: string;
  };
  diyTipSeed?: string;
  funFactSeed?: string;
}

export interface GenerateNewsletterInput {
  neighborhoodName: string;
  city: string;
  state: string;
  articles: ScrapedArticle[];      // From scraper (general neighborhood news)
  seedArticles?: ScrapedArticle[]; // From targeted seed search (real details on seeded topics)
  issueDate?: string;
  seeds?: NewsletterSeeds;
}

export interface GenerateNewsletterOutput {
  subject: string;       // Short subject line for the email
  preview_text: string;  // The hook — punchy, specific, shown in inbox preview
  content: NewsletterContent;
}

export async function generateNewsletter(
  input: GenerateNewsletterInput
): Promise<GenerateNewsletterOutput> {
  const {
    neighborhoodName,
    city,
    state,
    articles,
    seedArticles = [],
    seeds = {},
    issueDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  } = input;

  const season = getSeason();

  const systemPrompt = buildSystemPrompt({ neighborhoodName, city, state, issueDate, season });

  // Format articles for the prompt
  const formatArticles = (list: ScrapedArticle[], label: string) =>
    list.length
      ? `${label}:\n` + list.map((a, i) =>
          `${i + 1}. "${a.headline}" — ${a.description} (Source: ${a.source}, URL: ${a.url})`
        ).join("\n")
      : "";

  const generalArticleBlock = formatArticles(articles, "General neighborhood/city articles from this week");
  const seedArticleBlock = formatArticles(seedArticles, "Articles found specifically about the admin-seeded topics — use these for real details");

  const articleContext = [seedArticleBlock, generalArticleBlock].filter(Boolean).join("\n\n");

  const userPrompt = `Generate this week's ${neighborhoodName} newsletter.

${seeds.adminNotes ? `EDITOR NOTES — follow these:\n${seeds.adminNotes}\n` : ""}

SOURCE MATERIAL
${articleContext || `No articles found this week — use your knowledge of ${city}, ${state} community life.`}

---

SECTION INSTRUCTIONS

1. opening (ONE question — the hook, under 14 words)
This sits in the email header right below the date, rendered in italics inside quote marks.
Write ONE short question — under 14 words — that sounds like a friend texting the neighborhood group chat.
Not a statement. A question. Casual, specific, makes you want to answer it.
${seeds.hookSeed
  ? `Admin-seeded topic: "${seeds.hookSeed}"\nPull a real detail from the articles (street name, police dept, outcome) and fold it into the question. E.g. "Did anyone else get that active shooter alert from the Manor PD last week?"`
  : `Find the most gripping local angle from the articles and turn it into a punchy question.`
}
Rules: under 14 words. A question. No emojis. No bold. Sounds like a neighbor, not a brand.

2. local_news (2 to 3 items)
${seeds.localNewsSeed
  ? `Admin-seeded local stories: "${seeds.localNewsSeed}"\nSearch the provided articles for real details about these. For anything confirmed in the articles, include the specifics. For anything not in the articles, write based on the seed but be honest about what's known vs. what's developing.`
  : `Pull from the articles. Focus on things that directly affect ${neighborhoodName} residents.`
}
Each item: a real headline (not a teaser, not clickbait — tell them the news) + 2-3 sentences of body. Write like you're telling a friend what happened, not filing a report.

3. city_connection
ONE city-level story from ${city} that lands differently because of where we live.
${seeds.cityNewsSeed
  ? `Admin-seeded city story: "${seeds.cityNewsSeed}"\nFind any supporting details in the articles above.`
  : `Find the most relevant city-wide development in the articles and explain what it specifically means for ${neighborhoodName} homeowners or renters.`
}

4. neighborhood_checkin
A simple, opinionated poll question for residents.
${seeds.checkinSeed
  ? `Admin-seeded question or topic: "${seeds.checkinSeed}"`
  : `Pick something relevant to ${neighborhoodName} this ${season} — something with an actual opinion attached, not a neutral survey topic.`
}
Write 4 answer options that sound like things a real person would pick. No emojis in the options.

5. business_spotlight
${seeds.businessSpotlightSeed
  ? `Admin-seeded business — USE EXACTLY THIS:
Name: ${seeds.businessSpotlightSeed.name}
Description: ${seeds.businessSpotlightSeed.description}
Location: ${seeds.businessSpotlightSeed.location}
Write the description as 2 sentences max.`
  : `null — no business was seeded, so set business_spotlight to null.`
}

6. diy_tip
${seeds.diyTipSeed
  ? `Admin-seeded tip/topic: "${seeds.diyTipSeed}"`
  : `A practical ${season} home tip for ${city}, ${state}. Something actionable this week.`
}
Title: action-oriented, specific, no emojis. Body: max 4 sentences, useful and direct.

7. fun_fact
${seeds.funFactSeed
  ? `Use this: "${seeds.funFactSeed}"`
  : `One fact about ${city}/${state} history, today's date, or anything genuinely surprising. Max 2 sentences.`
}

---

IMPORTANT FORMATTING RULES
- No emojis anywhere in the output
- No section headers inside the content fields (the template adds those)
- Be specific when you have details. Vague = bad. "A shooting occurred" is bad. "Manor PD responded to a shooting on FM 973 near the 130 interchange" is good.
- The subject line is a hook, not a summary. It must make someone stop scrolling. Use specific local details + a consequence or reveal. Ask yourself: would someone forward this to a neighbor? If not, rewrite it. One complete sentence, active voice, under 80 chars.
- The preview_text should be the single most gripping line from this week — it's what shows in the inbox before someone opens the email. Make it land.
- NEVER use "you" or "your" — always "we," "our," "us," or "I." We are neighbors writing to neighbors, not a brand talking at subscribers.

Respond ONLY with valid JSON, no markdown fences:

{
  "subject": "a hook that makes someone stop scrolling — specific local detail + tension or reveal, active voice, one sentence, under 80 chars. E.g. 'Police tracked a shooter through our streets using cameras we didn't know were there'",
  "preview_text": "the one line that makes them open it — specific, no emojis, under 90 chars",
  "content": {
    "opening": "ONE question, under 14 words, like a friend texting the neighborhood group chat — e.g. 'Did anyone else get that active shooter alert from Manor PD last week?'",
    "local_news": [
      { "headline": "real headline, tells the news", "body": "2-3 sentences, specific details" }
    ],
    "city_connection": {
      "headline": "city story headline",
      "body": "what this means for ${neighborhoodName} residents"
    },
    "neighborhood_checkin": {
      "question": "poll question",
      "options": ["option 1", "option 2", "option 3", "option 4"]
    },
    "business_spotlight": null,
    "diy_tip": {
      "title": "action-oriented title",
      "body": "max 4 sentences"
    },
    "fun_fact": "1-2 sentences"
  }
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2500,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = (message.content[0] as { type: string; text: string }).text.trim();
  const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const parsed = JSON.parse(jsonStr) as GenerateNewsletterOutput;
  return parsed;
}

function getSeason(): string {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}
