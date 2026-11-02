import { NextResponse, type NextRequest } from "next/server";
import {
  NO_STORE,
  apiError,
  fieldIssues,
  logError,
  newRequestId,
  readJsonBody,
  validationError,
} from "@/lib/api";
import { isSameOrigin } from "@/lib/auth/origin";
import { guestSchema } from "@/lib/auth/schemas";
import { issueSessionToken, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";

/** §6.2 — guest accounts are pruned after 30 days. */
const GUEST_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * POST /api/auth/guest (spec.md §7.1) — `201 {user}` + guest session cookie.
 *
 * Guests are ordinary `users` rows with `is_guest = true`, no e-mail and no
 * password (DB CHECK enforces the last two). A guest session never carries
 * authenticated-user privileges: `isGuest` travels in the verified JWT and
 * every privileged decision re-checks it server-side (§9.1/§9.4).
 */
export async function POST(request: NextRequest) {
  const requestId = newRequestId();

  if (!isSameOrigin(request)) {
    return apiError(403, "ORIGIN_MISMATCH", "Cross-origin request rejected");
  }

  // The body is optional: `{}` or no payload both mean "default display name".
  const raw = await readJsonBody(request);
  const parsed = guestSchema.safeParse(raw === null ? {} : raw);
  if (!parsed.success) {
    return validationError(fieldIssues(parsed.error));
  }

  try {
    const user = await getPrisma().user.create({
      data: {
        displayName: parsed.data.displayName ?? "Guest",
        isGuest: true,
        email: null,
        passwordHash: null,
        guestExpiresAt: new Date(Date.now() + GUEST_TTL_MS),
      },
    });

    const token = await issueSessionToken({
      id: user.id,
      displayName: user.displayName,
      email: null,
      isGuest: true,
    });

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          displayName: user.displayName,
          email: null,
          isGuest: true,
        },
      },
      { status: 201, headers: { ...NO_STORE } },
    );
    response.cookies.set(sessionCookieName(), token, sessionCookieOptions());
    return response;
  } catch (error) {
    logError(requestId, "auth.guest", error);
    return apiError(500, "INTERNAL", "Something went wrong");
  }
}
