import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "@/lib/auth/secret";
import { sessionCookieName } from "@/lib/auth/cookies";

/**
 * Route protection (spec.md §14 P2 — "session middleware + route protection").
 *
 * Next 16 renamed `middleware.ts` to `proxy.ts` (verified in
 * node_modules/next/dist/docs — `middleware.js` is deprecated in favour of
 * `proxy.js`; same functionality). This file is the single proxy entry point.
 *
 * Policy:
 *  - app routes that require a verified session redirect to `/login`,
 *  - authenticated users are redirected away from `/login` and `/register`,
 *  - `/api/*` is NOT proxied — every API route authenticates itself
 *    (defence in depth: a proxy bypass cannot grant API access).
 */
const PROTECTED_PREFIXES = ["/dashboard", "/mysteries", "/play", "/results", "/history"];
const AUTH_PAGES = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsSession = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (!needsSession && !isAuthPage) {
    return NextResponse.next();
  }

  let hasSession = false;
  try {
    const token = await getToken({
      req: request,
      secret: getAuthSecret(),
      cookieName: sessionCookieName(),
    });
    hasSession = token !== null;
  } catch (error) {
    // Missing/misconfigured AUTH_SECRET must fail closed, with a signal.
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({ level: "error", scope: "proxy.auth", message }),
    );
    hasSession = false;
  }

  if (needsSession && !hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/mysteries/:path*",
    "/play/:path*",
    "/results/:path*",
    "/history/:path*",
    "/login",
    "/register",
  ],
};
