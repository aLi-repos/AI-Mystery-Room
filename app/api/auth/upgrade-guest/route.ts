import { NextResponse, type NextRequest } from "next/server";
import {
  NO_STORE,
  apiError,
  fieldIssues,
  isUniqueViolation,
  logError,
  newRequestId,
  readJsonBody,
  unauthorized,
  validationError,
} from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { isSameOrigin } from "@/lib/auth/origin";
import { checkRateLimit, clientIp } from "@/lib/auth/rateLimit";
import { upgradeGuestSchema } from "@/lib/auth/schemas";
import { getSessionUser, issueSessionToken, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";

/** Credential-bearing endpoint — same budget as login (§9.5). */
const UPGRADE_MAX_ATTEMPTS = 10;
const UPGRADE_WINDOW_MS = 15 * 60 * 1000;

/**
 * POST /api/auth/upgrade-guest (spec.md §7.1) — session (guest) required.
 * `200 {user}` — attaches credentials to the caller's own guest account.
 *
 * Isolation rules enforced here:
 *  - only a verified guest session may upgrade (never another user's),
 *  - the account upgraded is always the session's own row,
 *  - `409 EMAIL_TAKEN` when the e-mail belongs to a different account.
 */
export async function POST(request: NextRequest) {
  const requestId = newRequestId();

  if (!isSameOrigin(request)) {
    return apiError(403, "ORIGIN_MISMATCH", "Cross-origin request rejected");
  }

  const limit = checkRateLimit(
    `upgrade-guest:${clientIp(request)}`,
    UPGRADE_MAX_ATTEMPTS,
    UPGRADE_WINDOW_MS,
  );
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts — try again later",
          details: { retryAfterSeconds: limit.retryAfterSeconds },
        },
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds), ...NO_STORE },
      },
    );
  }

  const sessionUser = await getSessionUser(request);
  if (!sessionUser) return unauthorized();

  const parsed = upgradeGuestSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return validationError(fieldIssues(parsed.error));
  }

  const { email, password } = parsed.data;

  try {
    const db = getPrisma();

    // Re-read the row: sessions for pruned/converted accounts fail closed.
    const row = await db.user.findUnique({ where: { id: sessionUser.id } });
    if (!row) return unauthorized();
    if (!row.isGuest) {
      return apiError(
        409,
        "NOT_GUEST",
        "Only guest accounts can be upgraded",
      );
    }

    const taken = await db.user.findFirst({
      where: { email, id: { not: row.id } },
    });
    if (taken) {
      return apiError(409, "EMAIL_TAKEN", "That email is already registered");
    }

    const passwordHash = await hashPassword(password);
    const updated = await db.user.update({
      where: { id: row.id },
      data: {
        email,
        passwordHash,
        isGuest: false,
        guestExpiresAt: null,
      },
    });

    const token = await issueSessionToken({
      id: updated.id,
      displayName: updated.displayName,
      email: updated.email,
      isGuest: false,
    });

    const response = NextResponse.json(
      {
        user: {
          id: updated.id,
          displayName: updated.displayName,
          email: updated.email,
          isGuest: false,
        },
      },
      { headers: { ...NO_STORE } },
    );
    response.cookies.set(sessionCookieName(), token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return apiError(409, "EMAIL_TAKEN", "That email is already registered");
    }
    logError(requestId, "auth.upgrade-guest", error);
    return apiError(500, "INTERNAL", "Something went wrong");
  }
}
