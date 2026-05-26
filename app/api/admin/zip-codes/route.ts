import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// ── Auth helper ───────────────────────────────────────────────────────────────
function isAuthorized(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  return token === process.env.ADMIN_SECRET;
}

// ── GET /api/admin/zip-codes?neighborhoodId=... — list zip codes ──────────────
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const neighborhoodId = request.nextUrl.searchParams.get("neighborhoodId");
  if (!neighborhoodId) {
    return NextResponse.json({ error: "neighborhoodId is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("zip_neighborhood_map")
    .select("*")
    .eq("neighborhood_id", neighborhoodId)
    .order("zip_code");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ zipCodes: data });
}

// ── POST /api/admin/zip-codes — add a zip code mapping ───────────────────────
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { neighborhoodId: string; zipCode: string };
  const { neighborhoodId, zipCode } = body;

  if (!neighborhoodId || !zipCode) {
    return NextResponse.json({ error: "neighborhoodId and zipCode are required" }, { status: 400 });
  }

  const trimmed = zipCode.replace(/\D/g, "").slice(0, 5);
  if (trimmed.length !== 5) {
    return NextResponse.json({ error: "ZIP code must be 5 digits" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("zip_neighborhood_map")
    .insert({ neighborhood_id: neighborhoodId, zip_code: trimmed })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `ZIP ${trimmed} is already mapped to a neighborhood` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ zipCode: data });
}

// ── DELETE /api/admin/zip-codes?id=... — remove a zip code mapping ────────────
export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from("zip_neighborhood_map")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
