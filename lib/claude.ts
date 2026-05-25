/**
 * Claude newsletter generation
 * Uses claude-sonnet-4-6 for quality. Switch to haiku for cost savings.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ScrapedArticle } from "./scraper";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Output shape (stored as content_json in newsletter_issues) ───────────────
export interface NewsletterContent {
  top_news: Array<{
    headline: string;
    summary: string;
    url: string;
    local_angle: string;
  }>;
  person_of_week: {
    name: string;
    blurb: string;
  } | null;
  business_spotlight: {
    name: string;
    description: string;
    why_this_week: string;
  } | null;
  community_pulse: {
    type: "trivia" | "poll";
    question: string;
    options: string[];
    correct_answer?: string; // for trivia only
  };
  fun_fact: string;
  diy_tip: {
    title: string;
    body: string;
  };
}

export interface GenerateNewsletterInput {
  neighborhoodName: string;
  city: string;
  state: string;
  articles: ScrapedArticle[];
  personOfWeek?: { name: string; description: string } | null;
  pulseType?: "trivia" | "poll";
  pulseTopicHint?: string;
  diyTopicHint?: string;
  issueDate?: string; // e.g. "May 25, 2026"
}

export interface GenerateNewsletterOutput {
  subject: string;
  preview_text: string;
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
    personOfWeek,
    pulseType = "poll",
    pulseTopicHint,
    diyTopicHint,
    issueDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  } = input;

  const season = getSeason();
  const articleSummaries = articles
    .map(
      (a, i) =>
        `${i + 1}. "${a.headline}" — ${a.description} (Source: ${a.source}, URL: ${a.url})`
    )
    .join("\n");

  const systemPrompt = `You are the editor of Gild Society, a hyper-local community newsletter for ${neighborhoodName} in ${city}, ${state}.
Your tone is warm, direct, and community-focused — like a trusted neighbor who knows everything happening on the block.
You write clearly, avoid corporate speak, and always connect news back to what it means for residents specifically.
Today is ${issueDate}. It is currently ${season}.`;

  const userPrompt = `Generate a complete weekly newsletter for ${neighborhoodName}.

## Recent news articles to use as source material:
${articleSummaries || "No specific local articles found this week — use your knowledge of ${city}, ${state} community life and invent plausible relevant stories marked as 'Community Report'."}

## Newsletter sections to generate:

### 1. top_news (3 items)
For each article, write a neighborhood-focused headline and a 2-3 sentence summary explaining what it means for ${neighborhoodName} residents specifically. Use the provided URLs.

### 2. person_of_week
${
  personOfWeek
    ? `Write a warm 3-4 sentence spotlight about: ${personOfWeek.name}. Context: ${personOfWeek.description}`
    : "null — skip this section (no nomination this week)"
}

### 3. business_spotlight
Feature ONE local business near ${neighborhoodName} in ${city}. It can be a restaurant, service, shop, or contractor that residents would find useful. Make it feel like a genuine recommendation from a neighbor.

### 4. community_pulse
Type: ${pulseType}
${pulseTopicHint ? `Topic hint: ${pulseTopicHint}` : `Choose a relevant topic for ${neighborhoodName} residents this ${season}.`}
- If "poll": Write an opinion question with 4 answer options. No correct answer.
- If "trivia": Write a fun fact question about ${city}, ${state}, or the ${neighborhoodName} area with 4 options. Include the correct answer.

### 5. fun_fact
One surprising, delightful fact. Either about ${city}/${state} history, the current date in history, or a universally interesting tidbit. Keep it under 2 sentences.

### 6. diy_tip
${diyTopicHint ? `Topic: ${diyTopicHint}` : `Seasonal home tip relevant for ${season} in ${city}, ${state}. Something practical homeowners can do this week.`}
Title should be action-oriented (e.g. "5 ways to..."). Body: 3-4 punchy sentences.

## Output format — respond ONLY with valid JSON, no markdown:
{
  "subject": "catchy email subject line under 60 chars, specific to this week's content",
  "preview_text": "preview text under 90 chars that teases the content",
  "content": {
    "top_news": [
      { "headline": "...", "summary": "...", "url": "...", "local_angle": "one sentence on why this matters to ${neighborhoodName} residents" }
    ],
    "person_of_week": { "name": "...", "blurb": "..." } | null,
    "business_spotlight": { "name": "...", "description": "...", "why_this_week": "..." },
    "community_pulse": { "type": "poll|trivia", "question": "...", "options": ["...", "...", "...", "..."], "correct_answer": "..." },
    "fun_fact": "...",
    "diy_tip": { "title": "...", "body": "..." }
  }
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = (message.content[0] as { type: string; text: string }).text.trim();

  // Strip markdown code fences if Claude wrapped the JSON
  const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  const parsed = JSON.parse(jsonStr) as GenerateNewsletterOutput;
  return parsed;
}

// ── Helper ────────────────────────────────────────────────────────────────────
function getSeason(): string {
  const month = new Date().getMonth(); // 0-11
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}
