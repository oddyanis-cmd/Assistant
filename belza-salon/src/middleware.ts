/**
 * Next.js middleware for Belza Salon.
 *
 * Milestone 1: guards /admin/* so it returns 401 Unauthorized for any
 * unauthenticated request.  The full NextAuth session check is wired in
 * Milestone 2 once the credential provider is configured.
 *
 * The matcher ensures this middleware ONLY runs for /admin paths — public
 * routes (/book, /services, /api/…) are never touched.
 */

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /admin/* — requires authentication (enforced properly in Milestone 2)
  if (pathname.startsWith('/admin')) {
    // TODO (Milestone 2): replace with NextAuth session validation
    // For now, hard-block so no accidental exposure of the CRM shell
    return NextResponse.json(
      { error: 'Admin authentication is not yet configured.' },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
