/**
 * Responsive HTML email template for Gild Society newsletters.
 * Inline styles only — required for email client compatibility.
 *
 * Section order:
 *  1. Header  (logo + neighborhood + date + hook line)
 *  2. Local news items  (each has its own headline, no wrapper label)
 *  3. In [City] This Week
 *  4. Neighborhood Check-in
 *  5. Nominate a Neighbor
 *  6. Business Spotlight  (omitted if null)
 *  7. DIY Tip
 *  8. Fun Fact
 *  9. Footer
 */

import type { NewsletterContent } from "./claude";

interface RenderOptions {
  neighborhoodName: string;
  city: string;
  state: string;
  subject: string;
  content: NewsletterContent;
  issueDate?: string;
  unsubscribeUrl?: string;
}

const C = {
  red: "#FF5A5F",
  dark: "#484848",
  medium: "#767676",
  light: "#B0B0B0",
  surface: "#F7F7F7",
  border: "#EBEBEB",
  white: "#FFFFFF",
};

export function renderNewsletterHtml(opts: RenderOptions): string {
  const {
    neighborhoodName,
    city,
    content,
    issueDate = new Date().toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    }),
    unsubscribeUrl = "#",
  } = opts;

  const neighborhoodSlug = neighborhoodName.toLowerCase().replace(/\s+/g, "-");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://gildsociety.com";
  const sections: string[] = [];

  // ── 1. LOCAL NEWS ─────────────────────────────────────────────────────────────
  // No wrapper label — each item renders with its own headline.
  if (content.local_news?.length) {
    const items = content.local_news.map((item, i) => `
      <div style="padding:${i === 0 ? "0" : "20px"} 0 20px;${i < content.local_news.length - 1 ? `border-bottom:1px solid ${C.border};` : ""}">
        <p style="margin:0 0 10px 0;font-family:Georgia,serif;font-size:18px;font-weight:700;color:${C.dark};line-height:1.35;">
          ${item.headline}
        </p>
        <p style="margin:0;font-size:14px;color:${C.medium};line-height:1.8;">
          ${item.body}
        </p>
      </div>`).join("");

    sections.push(`
    <div style="background:${C.white};border:1px solid ${C.border};border-radius:16px;padding:24px;margin-bottom:16px;">
      ${items}
    </div>`);
  }

  // ── 3. IN [CITY] THIS WEEK ────────────────────────────────────────────────────
  if (content.city_connection) {
    const { headline, body } = content.city_connection;
    sections.push(card(
      `In ${city} This Week`,
      `<p style="margin:0 0 10px 0;font-family:Georgia,serif;font-size:17px;font-weight:700;color:${C.dark};line-height:1.35;">${headline}</p>
       <p style="margin:0;font-size:14px;color:${C.medium};line-height:1.8;">${body}</p>`
    ));
  }

  // ── 4. NEIGHBORHOOD CHECK-IN ──────────────────────────────────────────────────
  if (content.neighborhood_checkin) {
    const { question, options } = content.neighborhood_checkin;
    const optButtons = options.map((opt, i) => `
      <div style="margin-bottom:8px;">
        <a href="${appUrl}/${neighborhoodSlug}/checkin?a=${i}"
           style="display:block;padding:12px 16px;border:2px solid ${C.border};border-radius:10px;font-size:14px;font-weight:500;color:${C.dark};text-decoration:none;background:${C.white};">
          ${opt}
        </a>
      </div>`).join("");

    sections.push(card(
      "Neighborhood Check-in",
      `<p style="margin:0 0 16px 0;font-size:16px;font-weight:700;color:${C.dark};line-height:1.4;">${question}</p>
       ${optButtons}
       <p style="margin:10px 0 0 0;font-size:12px;color:${C.light};">Results shared in next week's edition.</p>`
    ));
  }

  // ── 5. NOMINATE A NEIGHBOR ────────────────────────────────────────────────────
  sections.push(`
  <div style="background:${C.red};border-radius:16px;padding:24px;margin-bottom:16px;">
    <p style="margin:0 0 6px 0;font-size:17px;font-weight:800;color:white;line-height:1.3;">
      Know a neighbor making a difference?
    </p>
    <p style="margin:0 0 18px 0;font-size:14px;color:rgba(255,255,255,0.88);line-height:1.6;">
      Every week we spotlight one person who makes ${neighborhoodName} a better place. Drop their name — it takes 30 seconds.
    </p>
    <a href="${appUrl}/${neighborhoodSlug}/nominate"
       style="display:inline-block;background:white;color:${C.red};font-weight:800;font-size:14px;padding:11px 22px;border-radius:10px;text-decoration:none;">
      Nominate someone
    </a>
  </div>`);

  // ── 6. BUSINESS SPOTLIGHT ─────────────────────────────────────────────────────
  // Only rendered when the admin seeded it — never fabricated.
  if (content.business_spotlight) {
    const { name, description, location } = content.business_spotlight;
    sections.push(card(
      "Business Spotlight",
      `<p style="margin:0 0 3px 0;font-size:17px;font-weight:800;color:${C.dark};">${name}</p>
       <p style="margin:0 0 10px 0;font-size:12px;color:${C.light};font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">${location}</p>
       <p style="margin:0;font-size:14px;color:${C.medium};line-height:1.8;">${description}</p>`
    ));
  }

  // ── 7. DIY TIP ────────────────────────────────────────────────────────────────
  if (content.diy_tip) {
    const { title, body } = content.diy_tip;
    sections.push(card(
      "DIY Tip",
      `<p style="margin:0 0 10px 0;font-size:16px;font-weight:800;color:${C.dark};">${title}</p>
       <p style="margin:0;font-size:14px;color:${C.medium};line-height:1.8;">${body}</p>`
    ));
  }

  // ── 8. FUN FACT ───────────────────────────────────────────────────────────────
  if (content.fun_fact) {
    sections.push(`
    <div style="background:${C.surface};border-left:3px solid ${C.red};border-radius:0 10px 10px 0;padding:18px 20px;margin-bottom:16px;">
      <p style="margin:0 0 6px 0;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:${C.medium};">Fun Fact</p>
      <p style="margin:0;font-size:14px;color:${C.dark};line-height:1.8;font-style:italic;">"${content.fun_fact}"</p>
    </div>`);
  }

  return wrapInShell({
    neighborhoodName,
    issueDate,
    hookLine: content.opening ?? "",
    body: sections.join(""),
    unsubscribeUrl,
    appUrl,
  });
}

// ── Layout helpers ─────────────────────────────────────────────────────────────
function card(title: string, body: string): string {
  return `
  <div style="background:${C.white};border:1px solid ${C.border};border-radius:16px;padding:24px;margin-bottom:16px;">
    <p style="margin:0 0 14px 0;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:${C.medium};">${title}</p>
    ${body}
  </div>`;
}

function wrapInShell(opts: {
  neighborhoodName: string;
  issueDate: string;
  hookLine: string;
  body: string;
  unsubscribeUrl: string;
  appUrl: string;
}): string {
  const { neighborhoodName, issueDate, hookLine, body, unsubscribeUrl, appUrl } = opts;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Gild Society — ${neighborhoodName}</title>
</head>
<body style="margin:0;padding:0;background:${C.surface};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};padding:16px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="padding:16px 16px 0;">
              <div style="background:${C.white};border-radius:16px 16px 0 0;padding:20px 24px 18px;border-bottom:1px solid ${C.border};">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="middle">
                      <span style="display:inline-block;width:32px;height:32px;background:${C.red};border-radius:8px;text-align:center;line-height:32px;font-size:16px;font-weight:900;color:white;vertical-align:middle;">G</span>
                      <span style="font-size:12px;font-weight:900;color:${C.dark};vertical-align:middle;margin-left:8px;letter-spacing:0.06em;text-transform:uppercase;">Gild Society</span>
                    </td>
                    <td align="right" valign="middle">
                      <span style="font-size:11px;color:${C.medium};font-weight:600;background:${C.surface};padding:4px 10px;border-radius:20px;">${neighborhoodName}</span>
                    </td>
                  </tr>
                </table>
                <p style="margin:14px 0 0;font-size:13px;color:${C.light};">${issueDate}</p>
                ${hookLine ? `<p style="margin:10px 0 0;font-size:15px;font-weight:400;color:${C.medium};line-height:1.5;font-family:Georgia,serif;font-style:italic;">"${hookLine}"</p>` : ""}
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 16px;">
              <div style="padding:16px 0;">
                ${body}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 16px 24px;">
              <div style="background:${C.white};border-radius:0 0 16px 16px;padding:18px 24px;border-top:1px solid ${C.border};text-align:center;">
                <p style="margin:0 0 8px;font-size:12px;color:${C.light};">
                  Gild Society &mdash; ${neighborhoodName} &mdash; ${new Date().getFullYear()}
                </p>
                <p style="margin:0;font-size:12px;color:${C.light};">
                  <a href="${unsubscribeUrl}" style="color:${C.light};text-decoration:underline;">Unsubscribe</a>
                  &nbsp;&middot;&nbsp;
                  <a href="${appUrl}" style="color:${C.light};text-decoration:underline;">View on web</a>
                </p>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
