import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// ── Auth helper ───────────────────────────────────────────────────────────────
function isAuthorized(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  return token === process.env.ADMIN_SECRET;
}

// ── POST /api/admin/neighborhoods — create a new neighborhood ─────────────────
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    name: string;
    slug: string;
    city: string;
    state: string;
  };

  const { name, slug, city, state } = body;

  if (!name || !slug || !city || !state) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  // Validate slug format
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json(
      { error: "Slug must be lowercase letters, numbers, and hyphens only" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("neighborhoods")
    .insert({ name, slug, city, state, active: true })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `A neighborhood with slug "${slug}" already exists` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ neighborhood: data });
}

// ── PATCH /api/admin/neighborhoods — edit an existing neighborhood ─────────────
export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    id: string;
    name?: string;
    city?: string;
    state?: string;
    active?: boolean;
  };

  const { id, name, city, state, active } = body;

  if (!id) {
    return NextResponse.json({ error: "Neighborhood id is required" }, { status: 400 });
  }

  // Build a strongly-typed patch with only the fields that were provided
  const patch: {
    name?: string;
    city?: string;
    state?: string;
    active?: boolean;
  } = {};
  if (name !== undefined) patch.name = name;
  if (city !== undefined) patch.city = city;
  if (state !== undefined) patch.state = state;
  if (active !== undefined) patch.active = active;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("neighborhoods")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ neighborhood: data });
}
