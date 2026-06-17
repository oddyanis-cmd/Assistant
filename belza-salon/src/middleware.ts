/**
 * Next.js middleware for Belza Salon.
 *
 * Guards /admin/* routes — redirects unauthenticated visitors to /login.
 * Uses the NextAuth v5 `auth()` helper which reads the JWT session cookie.
 */

export { auth as middleware } from '@/lib/auth';

export const config = {
  matcher: ['/admin/:path*'],
};
