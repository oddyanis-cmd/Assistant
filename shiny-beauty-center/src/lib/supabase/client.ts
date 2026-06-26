/**
 * Browser-side Supabase client (singleton).
 *
 * Safe to call without env vars set — returns null when Supabase is not
 * configured so pages can degrade gracefully during development / build.
 */
import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured, supabaseConfig } from "@/lib/config";
import type { Database } from "@/lib/supabase/types";

let _client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    // During build or when env is missing — caller must handle null.
    return null;
  }
  if (!_client) {
    _client = createBrowserClient<Database>(
      supabaseConfig.url,
      supabaseConfig.anonKey
    );
  }
  return _client;
}
