import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component — ignore set errors (middleware handles session refresh)
          }
        },
      },
    }
  );
}

/**
 * Service-role client — bypasses RLS for trusted server-side operations (cron, admin).
 *
 * Uses the raw @supabase/supabase-js client (NOT the SSR cookie-based one) so the
 * service-role JWT is always used directly. The @supabase/ssr createServerClient
 * reads auth from cookies, which can shadow the service-role key and trigger RLS
 * violations even when the service key is passed as the API key argument.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
