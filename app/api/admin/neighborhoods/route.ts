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

// ── DELETE /api/admin/neighborhoods?id=xxx — permanently remove a neighborhood ──
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

  // ── Safety check: block if the neighborhood still has subscribers ─────────
  const { count: subCount, error: subCountErr } = await supabase
    .from("subscribers")
    .select("id", { count: "exact", head: true })
    .eq("neighborhood_id", id);

  if (subCountErr) {
    return NextResponse.json({ error: subCountErr.message }, { status: 500 });
  }

  if (subCount && subCount > 0) {
    return NextResponse.json(
      {
        error: `This neighborhood still has ${subCount} subscriber${subCount !== 1 ? "s" : ""}. Remove all subscribers from the Subscribers tab before deleting the neighborhood.`,
      },
      { status: 409 }
    );
  }

  // ── Cascade-delete dependent rows (order matters for FK constraints) ───────

  // 1. ZIP codes
  const { error: zipErr } = await supabase
    .from("zip_neighborhood_map")
    .delete()
    .eq("neighborhood_id", id);
  if (zipErr) return NextResponse.json({ error: zipErr.message }, { status: 500 });

  // 2. Nominations
  const { error: nomErr } = await supabase
    .from("nominations")
    .delete()
    .eq("neighborhood_id", id);
  if (nomErr) return NextResponse.json({ error: nomErr.message }, { status: 500 });

  // 3. Newsletter issues (email_events/quiz_responses reference issues by nullable FK — left as orphans)
  const { error: issueErr } = await supabase
    .from("newsletter_issues")
    .delete()
    .eq("neighborhood_id", id);
  if (issueErr) return NextResponse.json({ error: issueErr.message }, { status: 500 });

  // 4. The neighborhood itself
  const { error: deleteErr } = await supabase
    .from("neighborhoods")
    .delete()
    .eq("id", id);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
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
