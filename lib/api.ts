import { NextResponse } from "next/server";

/**
 * Uniform API response helpers (spec.md §5.4).
 *
 * Error envelope: `{"error":{"code":"STRING_CODE","message":"…","details":{}}}`
 * Success = plain resource JSON.
 */

export type ApiErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};

export function apiError(
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

/** Standard validation failure (§7: errors follow the §5.4 envelope). */
export function validationError(details: Record<string, unknown> = {}): NextResponse<ApiErrorBody> {
  return apiError(400, "VALIDATION", "Invalid request payload", details);
}

export function unauthorized(message = "Authentication required"): NextResponse<ApiErrorBody> {
  return apiError(401, "UNAUTHORIZED", message);
}

/**
 * Server-side logging with a request id (§9.7 — structured logs, no secrets).
 * Never log passwords, hashes, tokens or AI keys.
 */
export function logError(requestId: string, scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ level: "error", requestId, scope, message }));
}

/** Parses a JSON body; returns `null` for missing/malformed payloads. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Turns a ZodError into `{ "field.path": "message" }` for `details`. */
export function fieldIssues(error: {
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>;
}): Record<string, string> {
  const details: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    details[key] = issue.message;
  }
  return details;
}

/** Prisma unique-constraint violation (e.g. concurrent duplicate e-mail). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** Fresh request id for structured error logs (§9.7). */
export function newRequestId(): string {
  return globalThis.crypto.randomUUID();
}

/** Marks a response as uncacheable (session-bearing payloads, §9.6). */
export const NO_STORE = { "Cache-Control": "no-store" } as const;
