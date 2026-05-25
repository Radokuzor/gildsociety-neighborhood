import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const user = data.session.user;

      // Upsert subscriber record using metadata from sign-up
      const meta = user.user_metadata as {
        first_name?: string;
        address?: string;
        neighborhood_id?: string;
      };

      if (meta.neighborhood_id) {
        // Use service role for this write (bypasses RLS during callback)
        const { createServiceClient } = await import("@/lib/supabase/server");
        const serviceSupabase = await createServiceClient();

        await serviceSupabase.from("subscribers").upsert(
          [
            {
              user_id: user.id,
              neighborhood_id: meta.neighborhood_id,
              first_name: meta.first_name ?? null,
              address: meta.address ?? null,
            },
          ],
          { onConflict: "user_id" }
        );
      }

      // Redirect to the neighborhood page (or fallback)
      const redirectTo = next.startsWith("/") ? `${origin}${next}` : origin;
      return NextResponse.redirect(redirectTo);
    }
  }

  // Auth failure — send back to home with error flag
  return NextResponse.redirect(`${origin}/?auth=error`);
}
