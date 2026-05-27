/**
 * Admin subscriber management
 * GET  /api/admin/subscribers?neighborhoodId=xxx  — list subscribers with email
 * DELETE /api/admin/subscribers?id=xxx            — remove a subscriber record
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function isAuthorized(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  return token === process.env.ADMIN_SECRET;
}

// GET /api/admin/subscribers?neighborhoodId=xxx
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const neighborhoodId = searchParams.get("neighborhoodId");

  if (!neighborhoodId) {
    return NextResponse.json({ error: "neighborhoodId is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: subscribers, error } = await supabase
    .from("subscribers")
    .select("id, user_id, neighborhood_id, first_name, last_name, created_at")
    .eq("neighborhood_id", neighborhoodId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with email from auth.admin (service role required)
  const enriched = await Promise.all(
    (subscribers ?? []).map(async (sub) => {
      try {
        const { data } = await supabase.auth.admin.getUserById(sub.user_id);
        return { ...sub, email: data.user?.email ?? null };
      } catch {
        return { ...sub, email: null };
      }
    })
  );

  return NextResponse.json({ subscribers: enriched });
}

// PATCH /api/admin/subscribers — move subscriber to a different neighborhood
// Body: { id: string, neighborhoodId: string }
export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; neighborhoodId?: string };
  try {
    body = await request.json() as { id?: string; neighborhoodId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, neighborhoodId } = body;
  if (!id || !neighborhoodId) {
    return NextResponse.json({ error: "id and neighborhoodId are required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("subscribers")
    .update({ neighborhood_id: neighborhoodId })
    .eq("id", id)
    .select("id, neighborhood_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subscriber: data });
}

// DELETE /api/admin/subscribers?id=xxx
export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("subscribers")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
