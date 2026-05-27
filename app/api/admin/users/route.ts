/**
 * Admin user management
 * GET  /api/admin/users          — all auth users merged with subscriber records
 * PATCH /api/admin/users         — assign (or move) a user to a neighborhood
 * DELETE /api/admin/users?userId=xxx — remove a user's subscriber record entirely
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function isAuthorized(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  return token === process.env.ADMIN_SECRET;
}

// GET /api/admin/users
// Returns every auth user merged with their subscriber row (if any).
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Fetch all auth users (up to 1000; add pagination if the project grows)
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Fetch all subscriber rows
  const { data: subscribers, error: subError } = await supabase
    .from("subscribers")
    .select("id, user_id, neighborhood_id, first_name, last_name, email, created_at");

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }

  const subsByUserId = Object.fromEntries(
    (subscribers ?? []).map((s) => [s.user_id, s])
  );

  const users = authData.users.map((user) => ({
    user_id: user.id,
    email: user.email ?? null,
    auth_created_at: user.created_at,
    last_sign_in: user.last_sign_in_at ?? null,
    subscriber: subsByUserId[user.id] ?? null,
  }));

  // Sort: unassigned first (they need attention), then by sign-up date
  users.sort((a, b) => {
    const aAssigned = !!a.subscriber?.neighborhood_id;
    const bAssigned = !!b.subscriber?.neighborhood_id;
    if (aAssigned !== bAssigned) return aAssigned ? 1 : -1;
    return new Date(b.auth_created_at).getTime() - new Date(a.auth_created_at).getTime();
  });

  return NextResponse.json({ users });
}

// PATCH /api/admin/users — assign or move a user to a neighborhood
// Body: { userId: string, neighborhoodId: string }
export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { userId?: string; neighborhoodId?: string };
  try {
    body = await request.json() as { userId?: string; neighborhoodId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, neighborhoodId } = body;
  if (!userId || !neighborhoodId) {
    return NextResponse.json({ error: "userId and neighborhoodId are required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Check if this user already has a subscriber record
  const { data: existing } = await supabase
    .from("subscribers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  let result;
  if (existing) {
    // Move to new neighborhood
    result = await supabase
      .from("subscribers")
      .update({ neighborhood_id: neighborhoodId })
      .eq("user_id", userId)
      .select("id, user_id, neighborhood_id, first_name, last_name, email, created_at")
      .single();
  } else {
    // Create a subscriber record for this user
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    result = await supabase
      .from("subscribers")
      .insert({
        user_id: userId,
        neighborhood_id: neighborhoodId,
        email: authUser?.user?.email ?? null,
      })
      .select("id, user_id, neighborhood_id, first_name, last_name, email, created_at")
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ subscriber: result.data });
}

// DELETE /api/admin/users?userId=xxx — remove subscriber record (user keeps auth account)
export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("subscribers")
    .delete()
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
