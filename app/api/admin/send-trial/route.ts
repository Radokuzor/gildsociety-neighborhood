/**
 * Admin: Send a trial copy of a newsletter draft to a single subscriber.
 * POST /api/admin/send-trial
 * Body: { issueId: string, email: string, firstName?: string }
 *
 * Does NOT mark the issue as sent and does NOT log email events.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendNewsletterBatch } from "@/lib/resend";

export async function POST(request: NextRequest) {
  // Admin auth check
  const adminToken = request.cookies.get("admin_token")?.value;
  if (adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { issueId?: string; email?: string; firstName?: string };
  try {
    body = (await request.json()) as { issueId?: string; email?: string; firstName?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { issueId, email, firstName } = body;
  if (!issueId) return NextResponse.json({ error: "issueId is required" }, { status: 400 });
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const supabase = createServiceClient();

  // Load the issue
  const { data: issue, error: issueError } = await supabase
    .from("newsletter_issues")
    .select("*")
    .eq("id", issueId)
    .single();

  if (issueError || !issue) {
    return NextResponse.json({ error: issueError?.message ?? "Issue not found" }, { status: 404 });
  }

  if (!issue.html_body) {
    return NextResponse.json(
      { error: "Issue has no HTML body — regenerate it first" },
      { status: 400 }
    );
  }

  // Load the neighborhood name for the sender label
  const { data: hood } = await supabase
    .from("neighborhoods")
    .select("name")
    .eq("id", issue.neighborhood_id)
    .single();

  const hoodName = hood?.name ?? "Gild Society";

  // Send to exactly one recipient — reuses the same batch sender
  const { sent, failed } = await sendNewsletterBatch(
    [{ email, firstName: firstName ?? "" }],
    `[TRIAL] ${issue.subject}`,
    issue.html_body,
    hoodName,
    issueId
  );

  if (sent === 0) {
    return NextResponse.json({ error: "Failed to send trial email", failed }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent, email });
}
