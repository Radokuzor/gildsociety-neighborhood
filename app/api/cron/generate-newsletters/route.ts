/**
 * Vercel Cron: runs every Tuesday 9am CT (14:00 UTC)
 * Schedule defined in vercel.json
 *
 * Also callable manually from admin panel via POST with admin auth.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { scrapeNeighborhoodNews } from "@/lib/scraper";
import { generateNewsletter } from "@/lib/claude";
import { renderNewsletterHtml } from "@/lib/email-template";

export const maxDuration = 60; // seconds (Vercel Pro allows up to 300)

export async function GET(request: NextRequest) {
  // Vercel Cron sends Authorization: Bearer CRON_SECRET
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Also allow admin manual trigger (checks admin cookie via query param)
  const adminToken = request.nextUrl.searchParams.get("admin_token");
  const isAdmin = adminToken === process.env.ADMIN_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional: only generate for a specific neighborhood
  const onlySlug = request.nextUrl.searchParams.get("neighborhood");

  const supabase = await createServiceClient();

  // Load all active neighborhoods (or just one if specified)
  const query = supabase
    .from("neighborhoods")
    .select("*")
    .eq("active", true);

  if (onlySlug) query.eq("slug", onlySlug);

  const { data: neighborhoods, error } = await query;

  if (error || !neighborhoods?.length) {
    return NextResponse.json({ error: "No neighborhoods found" }, { status: 404 });
  }

  const results: Array<{
    neighborhood: string;
    status: "success" | "error";
    issueId?: string;
    error?: string;
  }> = [];

  for (const hood of neighborhoods) {
    try {
      console.log(`Generating newsletter for ${hood.name}…`);

      // 1. Scrape news
      const articles = await scrapeNeighborhoodNews(
        hood.name,
        hood.city,
        hood.state
      );
      console.log(`  → Scraped ${articles.length} articles`);

      // 2. Get the selected nomination (if any)
      const { data: nomination } = await supabase
        .from("nominations")
        .select("nominee_name, nominee_description")
        .eq("neighborhood_id", hood.id)
        .eq("selected", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // 3. Generate with Claude
      const output = await generateNewsletter({
        neighborhoodName: hood.name,
        city: hood.city,
        state: hood.state,
        articles,
        personOfWeek: nomination
          ? {
              name: nomination.nominee_name,
              description: nomination.nominee_description,
            }
          : null,
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

      // 5. Save draft to database
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
        .select("id")
        .single();

      if (saveError) throw saveError;

      results.push({
        neighborhood: hood.name,
        status: "success",
        issueId: issue.id,
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

  return NextResponse.json({ results });
}
