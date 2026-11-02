import { NextResponse, type NextRequest } from "next/server";
import { NO_STORE, apiError, logError, newRequestId, unauthorized } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";

/**
 * GET /api/auth/me (spec.md §7.1) — session required.
 * `200 {user:{id,displayName,email,isGuest}}` or `401`.
 *
 * The session JWT is verified server-side (§9.1) and the user row is then
 * re-read so stale sessions for deleted or expired guest accounts fail closed.
 */
export async function GET(request: NextRequest) {
  // No `connection()` needed: this handler reads `request.cookies` (session
  // verification), which per the Next 16 route-handler docs stops build-time
  // prerendering — the route is evaluated per request automatically.
  const requestId = newRequestId();

  const sessionUser = await getSessionUser(request);
  if (!sessionUser) return unauthorized();

  try {
    const row = await getPrisma().user.findUnique({
      where: { id: sessionUser.id },
    });
    if (!row) return unauthorized();

    if (
      row.isGuest &&
      row.guestExpiresAt &&
      row.guestExpiresAt.getTime() <= Date.now()
    ) {
      return unauthorized("Guest session expired");
    }

    return NextResponse.json(
      {
        user: {
          id: row.id,
          displayName: row.displayName,
          email: row.email,
          isGuest: row.isGuest,
        },
      },
      { headers: { ...NO_STORE } },
    );
  } catch (error) {
    logError(requestId, "auth.me", error);
    return apiError(500, "INTERNAL", "Something went wrong");
  }
}
