/**
 * Server-side Supabase client (per-request, reads cookies for session).
 * Must be called inside a React Server Component or Route Handler.
 *
 * Returns null when Supabase is not configured (e.g. during `next build`).
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseConfigured, supabaseConfig } from "@/lib/config";
import type { Database } from "@/lib/supabase/types";

export async function getSupabaseServerClient() {
  if (!isSupabaseConfigured()) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(
    supabaseConfig.url,
    supabaseConfig.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — cookie mutations are ignored.
          }
        },
      },
    }
  );
}

/**
 * Service-role client for admin operations (migrations, seed, webhooks).
 * NEVER expose to the browser.
 */
export async function getSupabaseServiceClient() {
  if (!isSupabaseConfigured() || !supabaseConfig.serviceRoleKey) return null;

  const { createClient } = await import("@supabase/supabase-js");
  return createClient<Database>(supabaseConfig.url, supabaseConfig.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
