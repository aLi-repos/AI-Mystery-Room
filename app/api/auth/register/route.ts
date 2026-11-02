import { NextResponse, type NextRequest } from "next/server";
import {
  NO_STORE,
  apiError,
  fieldIssues,
  isUniqueViolation,
  logError,
  newRequestId,
  readJsonBody,
  validationError,
} from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { isSameOrigin } from "@/lib/auth/origin";
import { registerSchema } from "@/lib/auth/schemas";
import { issueSessionToken, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";

/**
 * POST /api/auth/register (spec.md §7.1).
 * `201 {user:{id,displayName,email}}` + session cookie; `409 EMAIL_TAKEN`.
 */
export async function POST(request: NextRequest) {
  const requestId = newRequestId();

  if (!isSameOrigin(request)) {
    return apiError(403, "ORIGIN_MISMATCH", "Cross-origin request rejected");
  }

  const parsed = registerSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return validationError(fieldIssues(parsed.error));
  }

  const { email, password, displayName } = parsed.data;

  try {
    const db = getPrisma();

    const existing = await db.user.findFirst({ where: { email } });
    if (existing) {
      return apiError(409, "EMAIL_TAKEN", "That email is already registered");
    }

    // bcrypt cost ≥ 12 (§9.2); the hash never leaves this function.
    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: { email, passwordHash, displayName, isGuest: false },
    });

    const token = await issueSessionToken({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      isGuest: false,
    });

    const response = NextResponse.json(
      { user: { id: user.id, displayName: user.displayName, email: user.email } },
      { status: 201, headers: { ...NO_STORE } },
    );
    response.cookies.set(sessionCookieName(), token, sessionCookieOptions());
    return response;
  } catch (error) {
    // Partial unique index on lower(email) turns races into 409s (§6.2).
    if (isUniqueViolation(error)) {
      return apiError(409, "EMAIL_TAKEN", "That email is already registered");
    }
    logError(requestId, "auth.register", error);
    return apiError(500, "INTERNAL", "Something went wrong");
  }
}
