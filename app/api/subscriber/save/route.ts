/**
 * Save (upsert) the current user's subscriber record.
 * Uses the service role so RLS never blocks it.
 * POST /api/subscriber/save
 * Body: { neighborhoodId, firstName, lastName, address }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Verify the caller is authenticated
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    neighborhoodId?: string;
    firstName?: string;
    lastName?: string;
    address?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { neighborhoodId, firstName, lastName, address } = body;

  if (!neighborhoodId) {
    return NextResponse.json({ error: "neighborhoodId is required" }, { status: 400 });
  }

  // Use service role so RLS never interferes
  const service = createServiceClient();

  // Probe whether last_name column exists before including it
  // (graceful fallback while migration 003 might not have run yet)
  const { error: probeError } = await service
    .from("subscribers")
    .select("last_name")
    .limit(0);

  const lastNameExists = !probeError;

  const { error } = await service
    .from("subscribers")
    .upsert(
      [
        {
          user_id: user.id,
          email: user.email ?? null,
          neighborhood_id: neighborhoodId,
          first_name: firstName?.trim() || null,
          last_name: lastNameExists ? (lastName?.trim() || null) : undefined,
          address: address?.trim() || null,
        },
      ],
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[subscriber/save] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
