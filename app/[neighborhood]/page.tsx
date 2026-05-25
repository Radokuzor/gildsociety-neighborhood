import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NeighborhoodPage from "@/components/neighborhood/NeighborhoodPage";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ neighborhood: string }>;
}

export default async function NeighborhoodRoute({ params }: Props) {
  const { neighborhood: slug } = await params;
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Load neighborhood
  const { data: hood } = await supabase
    .from("neighborhoods")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .single();

  if (!hood) notFound();

  const neighborhoodId = hood.id;

  // Load subscriber info
  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // Load most recent sent newsletter for this neighborhood
  const { data: latestIssue } = await supabase
    .from("newsletter_issues")
    .select("*")
    .eq("neighborhood_id", neighborhoodId)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1)
    .single();

  return (
    <NeighborhoodPage
      neighborhood={hood}
      subscriber={subscriber}
      latestIssue={latestIssue}
      userEmail={user.email ?? ""}
    />
  );
}

export async function generateMetadata({ params }: Props) {
  const { neighborhood: slug } = await params;
  const supabase = await createClient();

  const { data: hood } = await supabase
    .from("neighborhoods")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!hood) return {};

  return {
    title: `${hood.name} — Gild Society`,
    description: `Your hyper-local newsletter for ${hood.name}, ${hood.city} ${hood.state}. Real news from your neighbors.`,
  };
}
