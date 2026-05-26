import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Magic-link / OAuth callback.
 *
 * IMPORTANT: Cookies must be set directly on the NextResponse object that is
 * returned to the browser. Using `cookies()` from `next/headers` and then
 * returning a separate `NextResponse.redirect()` means the session cookies
 * are written to an internal Next.js buffer that never makes it onto the
 * redirect response — the browser never sees them, so the user stays logged out.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    // Build the redirect response FIRST so we can attach cookies to it.
    const redirectTo = next.startsWith("/") ? `${origin}${next}` : origin;
    const response = NextResponse.redirect(redirectTo);

    // Create a Supabase client whose setAll writes directly onto `response`.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return response; // session cookies are on this response ✓
    }
  }

  // Auth failure — redirect home with an error flag.
  return NextResponse.redirect(`${origin}/?auth=error`);
}
