/**
 * Same-origin check for mutating requests (spec.md §9.1 — "CSRF via
 * SameSite + origin check on mutations").
 *
 * Browsers send `Origin` on cross-origin POSTs; `SameSite=Lax` already blocks
 * cross-site cookies on POST, so this is defence in depth. Requests without an
 * `Origin` header (same-origin GETs, curl, tests) are allowed — they cannot
 * carry a foreign site's intent together with our cookie.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return origin === "null" ? false : true;

  const allowed = new Set<string>();
  const host = request.headers.get("host");
  if (host) allowed.add(host.toLowerCase());
  for (const url of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
  ]) {
    if (!url) continue;
    try {
      allowed.add(new URL(url).host.toLowerCase());
    } catch {
      // Ignore malformed optional configuration values.
    }
  }

  try {
    return allowed.has(new URL(origin).host.toLowerCase());
  } catch {
    return false;
  }
}

/** Returns a 403 response body-ish marker when the origin is foreign. */
export function originRejection(request: Request): boolean {
  return !isSameOrigin(request);
}
