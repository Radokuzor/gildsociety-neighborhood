/**
 * Admin: Save edits to a newsletter issue's content.
 * POST /api/admin/update-issue
 * Body: { issueId, subject, previewText, content }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export async function POST(request: NextRequest) {
  const adminToken = request.cookies.get("admin_token")?.value;
  if (adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { issueId, subject, previewText, content } = (await request.json()) as {
    issueId: string;
    subject: string;
    previewText: string;
    content: Json;
  };

  if (!issueId) {
    return NextResponse.json({ error: "issueId is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("newsletter_issues")
    .update({
      subject,
      preview_text: previewText,
      content_json: content,
    })
    .eq("id", issueId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
