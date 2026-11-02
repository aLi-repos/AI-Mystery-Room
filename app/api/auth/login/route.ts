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
import { authenticate } from "@/lib/auth/authorize";
import { isSameOrigin } from "@/lib/auth/origin";
import { checkRateLimit, clientIp } from "@/lib/auth/rateLimit";
import { loginSchema } from "@/lib/auth/schemas";
import { issueSessionToken, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";

/** §7.1 / §9.5 — login: 10 attempts per 15 minutes per IP. */
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/**
 * POST /api/auth/login (spec.md §7.1).
 * `200 {user}` + session cookie; `401 INVALID_CREDENTIALS` (generic);
 * `429 TOO_MANY_REQUESTS` with `Retry-After`.
 */
export async function POST(request: NextRequest) {
  const requestId = newRequestId();

  if (!isSameOrigin(request)) {
    return apiError(403, "ORIGIN_MISMATCH", "Cross-origin request rejected");
  }

  // Rate limit first so validation failures also consume the budget (§9.5).
  const limit = checkRateLimit(
    `login:${clientIp(request)}`,
    LOGIN_MAX_ATTEMPTS,
    LOGIN_WINDOW_MS,
  );
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many login attempts — try again later",
          details: { retryAfterSeconds: limit.retryAfterSeconds },
        },
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds), ...NO_STORE },
      },
    );
  }

  const parsed = loginSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return validationError(fieldIssues(parsed.error));
  }

  try {
    const user = await authenticate(parsed.data.email, parsed.data.password);
    if (!user) {
      // Generic message for unknown e-mail and wrong password alike (§9.2).
      return apiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const token = await issueSessionToken(user);
    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          isGuest: false,
        },
      },
      { headers: { ...NO_STORE } },
    );
    response.cookies.set(sessionCookieName(), token, sessionCookieOptions());
    return response;
  } catch (error) {
    logError(requestId, "auth.login", error);
    return apiError(500, "INTERNAL", "Something went wrong");
  }
}
