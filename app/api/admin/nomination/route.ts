import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/** Mark a nomination as selected (picked for next newsletter) */
export async function POST(request: NextRequest) {
  const adminToken = request.cookies.get("admin_token")?.value;
  if (adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("nominations")
    .update({ selected: true })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
