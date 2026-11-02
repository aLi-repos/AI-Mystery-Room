import { decode, encode, getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import {
  SESSION_MAX_AGE_SECONDS,
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/auth/cookies";
import { getAuthSecret } from "@/lib/auth/secret";

/**
 * Session issue/verify helpers (spec.md §9.1).
 *
 * Sessions are next-auth v4 JWTs, signed + encrypted with `AUTH_SECRET` and
 * stored in an HTTP-only cookie. Verification happens server-side on every
 * protected route via `getToken()` / `decode()` — the secret never leaves the
 * server and the token payload is never readable by client code.
 */

export type SessionUser = {
  id: string;
  displayName: string;
  email: string | null;
  isGuest: boolean;
};

type SessionClaims = {
  sub?: string;
  id?: string;
  name?: string;
  email?: string | null;
  isGuest?: boolean;
  exp?: number;
};

/** Mints the session JWT for a (registered or guest) user. */
export async function issueSessionToken(user: SessionUser): Promise<string> {
  const token: SessionClaims = {
    sub: user.id,
    id: user.id,
    name: user.displayName,
    email: user.email ?? undefined,
    isGuest: user.isGuest,
  };
  return encode({
    token,
    secret: getAuthSecret(),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Verifies a raw cookie value; returns `null` when absent/forged/expired. */
export async function readSessionClaims(
  rawToken: string | undefined | null,
): Promise<SessionClaims | null> {
  if (!rawToken) return null;
  try {
    const payload = await decode({ token: rawToken, secret: getAuthSecret() });
    if (!payload) return null;
    return payload as SessionClaims;
  } catch {
    return null;
  }
}

/** Extracts the verified session user from a request, or `null` (§9.1). */
export async function getSessionUser(
  request: NextRequest,
): Promise<SessionUser | null> {
  const token = await getToken({
    req: request,
    secret: getAuthSecret(),
    cookieName: sessionCookieName(),
  });
  return sessionUserFromClaims(token as SessionClaims | null);
}

/** Extracts the verified session user from a raw cookie value (pages). */
export async function getSessionUserFromCookie(
  rawToken: string | undefined | null,
): Promise<SessionUser | null> {
  return sessionUserFromClaims(await readSessionClaims(rawToken));
}

export function sessionUserFromClaims(
  claims: SessionClaims | null,
): SessionUser | null {
  if (!claims) return null;
  const id = claims.id ?? claims.sub;
  if (!id || typeof id !== "string") return null;
  if (typeof claims.exp === "number" && claims.exp * 1000 <= Date.now()) {
    return null;
  }
  return {
    id,
    displayName: typeof claims.name === "string" ? claims.name : "Player",
    email: typeof claims.email === "string" ? claims.email : null,
    isGuest: claims.isGuest === true,
  };
}

/** Cookie attributes used when setting/clearing the session cookie (§9.1). */
export { sessionCookieName, sessionCookieOptions };
