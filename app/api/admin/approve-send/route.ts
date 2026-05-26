/**
 * Admin: Approve a newsletter draft and send it to all neighborhood subscribers.
 * POST /api/admin/approve-send
 * Body: { issueId: string }
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

  let body: { issueId?: string };
  try {
    body = (await request.json()) as { issueId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { issueId } = body;
  if (!issueId) {
    return NextResponse.json({ error: "issueId is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Load the issue
  const { data: issue, error: issueError } = await supabase
    .from("newsletter_issues")
    .select("*")
    .eq("id", issueId)
    .single();

  if (issueError) {
    console.error("[approve-send] Issue query error:", issueError);
    return NextResponse.json(
      { error: `Database error: ${issueError.message}` },
      { status: 500 }
    );
  }

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  if (issue.status === "sent") {
    return NextResponse.json({ error: "Issue already sent" }, { status: 409 });
  }

  if (!issue.html_body) {
    return NextResponse.json(
      { error: "Issue has no HTML body — regenerate it first" },
      { status: 400 }
    );
  }

  // Load the neighborhood separately (avoids PostgREST join issues)
  const { data: hood, error: hoodError } = await supabase
    .from("neighborhoods")
    .select("name, city, state")
    .eq("id", issue.neighborhood_id)
    .single();

  if (hoodError) {
    console.error("[approve-send] Neighborhood query error:", hoodError);
    return NextResponse.json(
      { error: `Database error: ${hoodError.message}` },
      { status: 500 }
    );
  }

  if (!hood) {
    return NextResponse.json({ error: "Neighborhood not found" }, { status: 404 });
  }

  // Load all subscribers for this neighborhood
  const { data: subscribers, error: subError } = await supabase
    .from("subscribers")
    .select("user_id, first_name")
    .eq("neighborhood_id", issue.neighborhood_id);

  if (subError) {
    console.error("[approve-send] Subscribers query error:", subError);
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }

  if (!subscribers || subscribers.length === 0) {
    // No subscribers to email, but still mark the issue as sent so it can be pinned
    await supabase
      .from("newsletter_issues")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", issueId);
    return NextResponse.json({ sent: 0, status: "sent", message: "No subscribers yet — article marked as sent and ready to pin." });
  }

  // Get emails for each user_id via auth admin API
  const userIds = subscribers.map((s) => s.user_id);
  const emailMap: Record<string, string> = {};

  for (const uid of userIds) {
    const { data: userData } = await supabase.auth.admin.getUserById(uid);
    if (userData?.user?.email) {
      emailMap[uid] = userData.user.email;
    }
  }

  const recipients = subscribers
    .filter((s) => emailMap[s.user_id])
    .map((s) => ({
      email: emailMap[s.user_id],
      firstName: s.first_name,
    }));

  if (recipients.length === 0) {
    return NextResponse.json({ sent: 0, message: "No subscriber emails found." });
  }

  // Send via Resend
  const { sent, failed } = await sendNewsletterBatch(
    recipients,
    issue.subject,
    issue.html_body,
    hood.name,
    issueId
  );

  // Mark issue as sent
  await supabase
    .from("newsletter_issues")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", issueId);

  // Log sent events
  if (sent > 0) {
    const sentRecipients = recipients.slice(0, sent);
    await supabase.from("email_events").insert(
      sentRecipients.map((r) => ({
        issue_id: issueId,
        email: r.email,
        event_type: "sent" as const,
      }))
    );
  }

  return NextResponse.json({ sent, failed, total: recipients.length });
}
