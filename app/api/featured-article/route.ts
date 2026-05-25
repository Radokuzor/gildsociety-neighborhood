import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const neighborhoodId = searchParams.get("neighborhoodId");

  if (!neighborhoodId) {
    return NextResponse.json({ issue: null }, { status: 400 });
  }

  const supabase = await createClient();

  // Get the neighborhood's pinned featured issue
  const { data: hood } = await supabase
    .from("neighborhoods")
    .select("featured_issue_id")
    .eq("id", neighborhoodId)
    .single();

  let issue = null;

  if (hood?.featured_issue_id) {
    const { data } = await supabase
      .from("newsletter_issues")
      .select("*")
      .eq("id", hood.featured_issue_id)
      .single();
    issue = data;
  } else {
    // Fallback: most recent sent issue
    const { data } = await supabase
      .from("newsletter_issues")
      .select("*")
      .eq("neighborhood_id", neighborhoodId)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .single();
    issue = data;
  }

  return NextResponse.json({ issue });
}
