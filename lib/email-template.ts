/**
 * Responsive HTML email template for Gild Society newsletters.
 * Uses inline styles only — required for email client compatibility.
 * Mobile-first, tested patterns.
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

// ── Brand colors ──────────────────────────────────────────────────────────────
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
    state,
    content,
    issueDate = new Date().toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    }),
    unsubscribeUrl = "#",
  } = opts;

  const sections: string[] = [];

  // ── Top news ──────────────────────────────────────────────────────────────
  if (content.top_news?.length) {
    const newsItems = content.top_news
      .map(
        (item) => `
        <div style="padding:16px 0;border-bottom:1px solid ${C.border};">
          <a href="${item.url}" style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:${C.dark};text-decoration:none;line-height:1.4;display:block;margin-bottom:8px;">
            ${item.headline}
          </a>
          <p style="margin:0 0 6px 0;font-size:15px;color:${C.dark};line-height:1.6;">${item.summary}</p>
          <p style="margin:0;font-size:13px;color:${C.red};font-weight:600;">${item.local_angle}</p>
        </div>`
      )
      .join("");

    sections.push(card("📰 Top News This Week", newsItems));
  }

  // ── Person of the week ────────────────────────────────────────────────────
  if (content.person_of_week) {
    const { name, blurb } = content.person_of_week;
    sections.push(
      card(
        "⭐ Person of the Week",
        `<table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="56" valign="top">
              <div style="width:48px;height:48px;border-radius:50%;background:${C.surface};display:flex;align-items:center;justify-content:center;font-size:22px;text-align:center;line-height:48px;">👤</div>
            </td>
            <td style="padding-left:12px;">
              <p style="margin:0 0 4px 0;font-size:17px;font-weight:800;color:${C.dark};">${name}</p>
              <p style="margin:0;font-size:14px;color:${C.medium};line-height:1.6;">${blurb}</p>
            </td>
          </tr>
        </table>`
      )
    );
  }

  // ── Business spotlight ────────────────────────────────────────────────────
  if (content.business_spotlight) {
    const { name, description, why_this_week } = content.business_spotlight;
    sections.push(
      card(
        "🏪 Local Business Spotlight",
        `<p style="margin:0 0 6px 0;font-size:18px;font-weight:800;color:${C.dark};">${name}</p>
         <p style="margin:0 0 8px 0;font-size:14px;color:${C.medium};line-height:1.6;">${description}</p>
         <p style="margin:0;font-size:12px;font-weight:700;color:${C.red};text-transform:uppercase;letter-spacing:0.05em;">${why_this_week}</p>`
      )
    );
  }

  // ── Community pulse ───────────────────────────────────────────────────────
  if (content.community_pulse) {
    const { type, question, options } = content.community_pulse;
    const label = type === "trivia" ? "🧠 Neighborhood Trivia" : "🗳️ Community Pulse";
    const optButtons = options
      .map(
        (opt) =>
          `<div style="margin-bottom:8px;">
            <a href="#" style="display:block;padding:12px 16px;border:2px solid ${C.border};border-radius:12px;font-size:14px;font-weight:600;color:${C.dark};text-decoration:none;background:${C.white};">
              ${opt}
            </a>
          </div>`
      )
      .join("");

    sections.push(
      card(
        label,
        `<p style="margin:0 0 14px 0;font-size:16px;font-weight:700;color:${C.dark};">${question}</p>
         ${optButtons}
         <p style="margin:8px 0 0 0;font-size:12px;color:${C.light};">Results visible to the community after voting.</p>`
      )
    );
  }

  // ── Fun fact ──────────────────────────────────────────────────────────────
  if (content.fun_fact) {
    sections.push(
      `<div style="background:${C.surface};border-radius:16px;padding:20px;margin-bottom:16px;">
        <p style="margin:0 0 8px 0;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:${C.medium};">💡 Fun Fact</p>
        <p style="margin:0;font-size:15px;color:${C.dark};line-height:1.7;font-style:italic;">"${content.fun_fact}"</p>
      </div>`
    );
  }

  // ── DIY tip ───────────────────────────────────────────────────────────────
  if (content.diy_tip) {
    const { title, body } = content.diy_tip;
    sections.push(
      card(
        "🔧 DIY & Home Tips",
        `<p style="margin:0 0 8px 0;font-size:17px;font-weight:800;color:${C.dark};">${title}</p>
         <p style="margin:0;font-size:14px;color:${C.medium};line-height:1.7;">${body}</p>`
      )
    );
  }

  // ── Nominate CTA ──────────────────────────────────────────────────────────
  sections.push(
    `<div style="background:${C.red};border-radius:20px;padding:24px;margin-bottom:16px;text-align:center;">
      <p style="margin:0 0 6px 0;font-size:17px;font-weight:800;color:white;">Know a neighbor making a difference?</p>
      <p style="margin:0 0 16px 0;font-size:14px;color:rgba(255,255,255,0.85);">Nominate them for Person of the Week in ${neighborhoodName}.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://gildsociety.com"}/${neighborhoodName.toLowerCase().replace(/\s+/g, "-")}/nominate"
         style="display:inline-block;background:white;color:${C.red};font-weight:700;font-size:14px;padding:12px 24px;border-radius:12px;text-decoration:none;">
        Submit a nomination →
      </a>
    </div>`
  );

  return wrapInShell({
    neighborhoodName,
    city,
    state,
    issueDate,
    body: sections.join(""),
    unsubscribeUrl,
  });
}

// ── Layout helpers ─────────────────────────────────────────────────────────────
function card(title: string, body: string): string {
  return `
  <div style="background:${C.white};border:1px solid ${C.border};border-radius:16px;padding:20px;margin-bottom:16px;">
    <p style="margin:0 0 14px 0;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:${C.medium};">${title}</p>
    ${body}
  </div>`;
}

function wrapInShell(opts: {
  neighborhoodName: string;
  city: string;
  state: string;
  issueDate: string;
  body: string;
  unsubscribeUrl: string;
}): string {
  const { neighborhoodName, city, state, issueDate, body, unsubscribeUrl } = opts;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Gild Society — ${neighborhoodName}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:${C.surface};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Preheader (hidden, shown in inbox preview) -->
  <div style="display:none;font-size:1px;color:${C.surface};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Your ${neighborhoodName} community update for ${issueDate}
  </div>

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};padding:16px 0;">
    <tr>
      <td align="center">
        <!-- Inner container: max 600px, full width on mobile -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="padding:16px 16px 0;">
              <div style="background:${C.white};border-radius:20px 20px 0 0;padding:24px 24px 20px;border-bottom:1px solid ${C.border};">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="middle">
                      <div style="display:inline-block;width:36px;height:36px;background:${C.red};border-radius:10px;text-align:center;line-height:36px;font-size:18px;font-weight:900;color:white;vertical-align:middle;">G</div>
                      <span style="font-size:13px;font-weight:800;color:${C.dark};vertical-align:middle;margin-left:8px;">GILD SOCIETY</span>
                    </td>
                    <td align="right" valign="middle">
                      <span style="font-size:11px;color:${C.medium};font-weight:600;background:${C.surface};padding:4px 10px;border-radius:20px;">${neighborhoodName}</span>
                    </td>
                  </tr>
                </table>
                <p style="margin:16px 0 4px;font-size:24px;font-weight:900;color:${C.dark};line-height:1.2;">Hey {{firstName}} 👋</p>
                <p style="margin:0;font-size:14px;color:${C.medium};">${issueDate} · ${city}, ${state}</p>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 16px;">
              <div style="background:${C.surface};padding:16px 0;">
                ${body}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 16px 24px;">
              <div style="background:${C.white};border-radius:0 0 20px 20px;padding:20px 24px;border-top:1px solid ${C.border};text-align:center;">
                <p style="margin:0 0 8px;font-size:12px;color:${C.light};">
                  © ${new Date().getFullYear()} Gild Society · ${neighborhoodName} Edition
                </p>
                <p style="margin:0;font-size:12px;color:${C.light};">
                  <a href="${unsubscribeUrl}" style="color:${C.light};text-decoration:underline;">Unsubscribe</a>
                  &nbsp;·&nbsp;
                  <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://gildsociety.com"}" style="color:${C.light};text-decoration:underline;">View on web</a>
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
