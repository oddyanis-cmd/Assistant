import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const intlMiddleware = createMiddleware(routing);

// Routes that require authentication (prefix matching)
const PROTECTED_PREFIXES = [
  "/en/portal",
  "/ar/portal",
  "/en/admin",
  "/ar/admin",
  "/en/staff",
  "/ar/staff",
];
// Routes that should redirect to portal if already authenticated
const AUTH_ROUTES = ["/en/auth", "/ar/auth"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((prefix) => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  // First, run the intl middleware to handle locale routing
  const intlResponse = intlMiddleware(request);

  const pathname = request.nextUrl.pathname;

  // Only check auth on protected/auth routes
  if (!isProtected(pathname) && !isAuthRoute(pathname)) {
    return intlResponse;
  }

  // Guard: if Supabase isn't configured, let the page handle it gracefully
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return intlResponse;
  }

  // Build a response object we can mutate with refreshed cookies
  const response = intlResponse ?? NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>
      ) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh session (important: always call getUser, not getSession)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Determine locale prefix for redirects
  const locale = pathname.startsWith("/ar") ? "ar" : "en";

  if (isProtected(pathname) && !user) {
    const signInUrl = new URL(`/${locale}/auth/signin`, request.url);
    signInUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAuthRoute(pathname) && user) {
    return NextResponse.redirect(new URL(`/${locale}/portal`, request.url));
  }

  return response;
}

export const config = {
  // next-intl: match all paths except static files and Next.js internals
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
