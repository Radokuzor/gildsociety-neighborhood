/**
 * Resend email sender
 * Handles: transactional batch sends for newsletter broadcasts
 * Docs: https://resend.com/docs
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "hello@gildsociety.com";

export interface NewsletterRecipient {
  email: string;
  firstName: string | null;
}

/**
 * Send the newsletter to a list of recipients.
 * Uses Resend batch API (up to 100 per call, handles chunking automatically).
 */
export async function sendNewsletterBatch(
  recipients: NewsletterRecipient[],
  subject: string,
  htmlBody: string,
  neighborhoodName: string,
  issueId: string
): Promise<{ sent: number; failed: number }> {
  if (recipients.length === 0) return { sent: 0, failed: 0 };

  // Resend batch: max 100 per call
  const CHUNK_SIZE = 100;
  const chunks: NewsletterRecipient[][] = [];
  for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
    chunks.push(recipients.slice(i, i + CHUNK_SIZE));
  }

  let sent = 0;
  let failed = 0;

  for (const chunk of chunks) {
    const batch = chunk.map((r) => ({
      from: `${neighborhoodName} — Gild Society <${FROM_EMAIL}>`,
      to: r.email,
      subject,
      html: personalizeHtml(htmlBody, r.firstName),
      headers: {
        // Track opens/clicks — Resend auto-adds tracking pixel
        "X-Issue-Id": issueId,
      },
      tags: [
        { name: "issue_id", value: issueId },
        { name: "neighborhood", value: neighborhoodName.toLowerCase().replace(/\s+/g, "-") },
      ],
    }));

    try {
      const { data, error } = await resend.batch.send(batch);
      if (error) {
        console.error("Resend batch error:", error);
        failed += chunk.length;
      } else {
        sent += (data ?? []).length;
      }
    } catch (err) {
      console.error("Resend batch threw:", err);
      failed += chunk.length;
    }
  }

  return { sent, failed };
}

/**
 * Personalize HTML — replace {{firstName}} placeholder
 */
function personalizeHtml(html: string, firstName: string | null): string {
  const name = firstName ?? "neighbor";
  return html.replace(/\{\{firstName\}\}/g, name);
}

/**
 * Add a contact to Resend audience (optional — for future segmentation)
 * Currently we use Supabase as the source of truth for subscribers.
 */
export async function upsertResendContact(
  audienceId: string,
  email: string,
  firstName: string | null,
  neighborhood: string
): Promise<void> {
  if (!audienceId) return;

  try {
    await resend.contacts.create({
      audienceId,
      email,
      firstName: firstName ?? undefined,
      unsubscribed: false,
    });
  } catch (err) {
    // Non-fatal — Supabase is source of truth
    console.warn("Failed to add Resend contact:", err);
  }
}
