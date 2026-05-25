/**
 * Admin: Pin a newsletter issue as the featured article for a neighborhood (homepage).
 * Also allows setting the default_neighborhood_slug app setting.
 * POST /api/admin/pin-featured
 * Body: { neighborhoodId: string, issueId: string | null }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const adminToken = request.cookies.get("admin_token")?.value;
  if (adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { neighborhoodId, issueId } = (await request.json()) as {
    neighborhoodId: string;
    issueId: string | null;
  };

  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("neighborhoods")
    .update({ featured_issue_id: issueId })
    .eq("id", neighborhoodId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Set which neighborhood shows by default on the homepage */
export async function PUT(request: NextRequest) {
  const adminToken = request.cookies.get("admin_token")?.value;
  if (adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = (await request.json()) as { slug: string };
  const supabase = await createServiceClient();

  const { error } = await supabase
    .from("app_settings")
    .upsert([{ key: "default_neighborhood_slug", value: slug, updated_at: new Date().toISOString() }], {
      onConflict: "key",
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
