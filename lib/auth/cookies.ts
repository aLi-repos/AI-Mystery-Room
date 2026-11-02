/**
 * Session cookie policy (spec.md §9.1: HTTP-only, Secure, SameSite=Lax;
 * §9.9: 7-day absolute session expiry).
 *
 * The cookie NAME must match what next-auth's `getToken()` reads, and what
 * the mounted NextAuth handler sets. next-auth v4 derives the secure prefix
 * from `NEXTAUTH_URL` / `VERCEL`, so we mirror exactly that derivation and
 * always pass the name explicitly to avoid any drift.
 */
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days (§9.9)

export function useSecureCookies(): boolean {
  if (process.env.VERCEL) return true;
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  if (nextAuthUrl) return nextAuthUrl.startsWith("https://");
  return false;
}

export function sessionCookieName(): string {
  return `${useSecureCookies() ? "__Secure-" : ""}next-auth.session-token`;
}

export function sessionCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookies(),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
