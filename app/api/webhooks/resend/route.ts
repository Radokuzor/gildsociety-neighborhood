/**
 * Resend webhook receiver — tracks email opens and clicks.
 *
 * Setup in Resend dashboard:
 *   Webhooks → Add endpoint → https://gildsociety.com/api/webhooks/resend
 *   Events: email.opened, email.clicked, email.delivered
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

interface ResendWebhookPayload {
  type: "email.sent" | "email.delivered" | "email.opened" | "email.clicked" | "email.bounced";
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    tags?: Array<{ name: string; value: string }>;
    created_at: string;
  };
}

export async function POST(request: NextRequest) {
  // Verify webhook signature (optional but recommended — add Resend signing secret)
  // const signature = request.headers.get("svix-signature");
  // For now, we rely on the endpoint being secret (not publicly guessable)

  let payload: ResendWebhookPayload;
  try {
    payload = await request.json() as ResendWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventTypeMap: Record<string, "sent" | "opened" | "clicked"> = {
    "email.sent": "sent",
    "email.delivered": "sent",
    "email.opened": "opened",
    "email.clicked": "clicked",
  };

  const eventType = eventTypeMap[payload.type];
  if (!eventType) {
    // Ignore bounces etc for now
    return NextResponse.json({ ok: true });
  }

  // Extract issue_id from tags
  const issueId = payload.data.tags?.find((t) => t.name === "issue_id")?.value;
  const recipientEmail = payload.data.to?.[0];

  if (!recipientEmail) {
    return NextResponse.json({ ok: true });
  }

  const supabase = await createServiceClient();

  // Insert email event
  await supabase.from("email_events").insert([
    {
      issue_id: issueId ?? null,
      email: recipientEmail,
      event_type: eventType,
      occurred_at: payload.data.created_at ?? new Date().toISOString(),
    },
  ]);

  return NextResponse.json({ ok: true });
}
