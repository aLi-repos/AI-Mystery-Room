import { NextResponse, type NextRequest } from "next/server";
import { NO_STORE, apiError } from "@/lib/api";
import { isSameOrigin } from "@/lib/auth/origin";
import { sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";

/**
 * POST /api/auth/logout (spec.md §7.1) — `204`, clears the session cookie.
 * Idempotent: logging out without a session also returns 204.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return apiError(403, "ORIGIN_MISMATCH", "Cross-origin request rejected");
  }

  const response = new NextResponse(null, {
    status: 204,
    headers: { ...NO_STORE },
  });
  response.cookies.set(sessionCookieName(), "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
