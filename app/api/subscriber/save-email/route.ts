/**
 * Upserts a stub subscriber row immediately after magic-link sign-in.
 * Captures the email before the user completes the full onboarding form.
 * POST /api/subscriber/save-email
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Verify the caller is authenticated
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const service = createServiceClient();

  // Upsert with only email + user_id — leave name/address/neighborhood null
  // until the user completes onboarding. Use ignoreDuplicates so a full
  // subscriber record is never overwritten by this stub.
  const { error } = await service
    .from("subscribers")
    .upsert(
      [{ user_id: user.id, email: user.email ?? null }],
      { onConflict: "user_id", ignoreDuplicates: true }
    );

  if (error) {
    console.error("[subscriber/save-email] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
