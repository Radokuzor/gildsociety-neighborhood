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
      // Subscriber data is collected and saved by OnboardingOverlay after the
      // user lands back on the site. No upsert needed here.

      // Redirect to wherever the magic link pointed (e.g. /?n=slug&show=onboarding)
      const redirectTo = next.startsWith("/") ? `${origin}${next}` : origin;
      return NextResponse.redirect(redirectTo);
    }
  }

  // Auth failure — send back to home with error flag
  return NextResponse.redirect(`${origin}/?auth=error`);
}
