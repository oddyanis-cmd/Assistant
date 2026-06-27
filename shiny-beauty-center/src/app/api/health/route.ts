/**
 * GET /api/health
 *
 * Returns a JSON snapshot of application wiring status. Designed for testers
 * and ops to confirm that environment variables are wired correctly before
 * exercising any role end-to-end.
 *
 * Security contract:
 *   - NEVER returns secret values (keys, tokens, passwords).
 *   - Only exposes boolean flags derived from the presence/absence of config.
 *
 * Runtime: nodejs (needs process.env access; not compatible with edge runtime
 * because `isSupabaseConfigured` reads server-only vars).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { isSupabaseConfigured, featureFlags } from "@/lib/config";

export async function GET(): Promise<NextResponse> {
  const body = {
    status: "ok",
    time: new Date().toISOString(),
    supabaseConfigured: isSupabaseConfigured(),
    paymentsEnabled: featureFlags.paymentsEnabled,
    notificationsEnabled: featureFlags.notificationsEnabled,
  };

  return NextResponse.json(body, {
    status: 200,
    headers: {
      // Do not cache — this is a live status endpoint
      "Cache-Control": "no-store",
    },
  });
}
