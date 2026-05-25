import { createServiceClient } from "@/lib/supabase/server";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createServiceClient();

  // Load all neighborhoods
  const { data: neighborhoods } = await supabase
    .from("neighborhoods")
    .select("*")
    .order("name");

  // Load all newsletter issues with neighborhood name
  const { data: issues } = await supabase
    .from("newsletter_issues")
    .select("id, neighborhood_id, subject, preview_text, status, created_at, sent_at, neighborhoods(name, slug)")
    .order("created_at", { ascending: false })
    .limit(50);

  // Load default neighborhood setting
  const { data: setting } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "default_neighborhood_slug")
    .single();

  // Load analytics: email events grouped by issue
  const { data: eventCounts } = await supabase
    .from("email_events")
    .select("issue_id, event_type");

  // Load subscriber counts per neighborhood
  const { data: subCounts } = await supabase
    .from("subscribers")
    .select("neighborhood_id");

  // Load pending nominations
  const { data: nominations } = await supabase
    .from("nominations")
    .select("*")
    .eq("selected", false)
    .order("created_at", { ascending: false });

  return (
    <AdminDashboard
      neighborhoods={neighborhoods ?? []}
      issues={(issues ?? []) as AdminIssue[]}
      defaultNeighborhoodSlug={setting?.value ?? "wildhorse-ranch"}
      eventCounts={eventCounts ?? []}
      subCounts={subCounts ?? []}
      nominations={nominations ?? []}
    />
  );
}

export interface AdminIssue {
  id: string;
  neighborhood_id: string;
  subject: string;
  preview_text: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
  neighborhoods: { name: string; slug: string } | null;
}
