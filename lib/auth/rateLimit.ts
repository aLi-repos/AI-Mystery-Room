/**
 * In-memory sliding-window rate limiting (spec.md §9.5).
 *
 * Login: 10 attempts / 15 min / IP (§7.1). This is a per-process store —
 * sufficient for the MVP on a single instance; a shared store (e.g. Redis or
 * a DB table) is a post-MVP concern. Exposed `reset()` for deterministic tests.
 */

type Window = { hits: number[] };

const windows = new Map<string, Window>();

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const existing = windows.get(key);
  const hits = (existing?.hits ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    const oldest = hits[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000),
    );
    return { ok: false, retryAfterSeconds };
  }
  hits.push(now);
  windows.set(key, { hits });
  if (windows.size > 10_000) {
    // Defensive sweep: drop fully expired windows to bound memory.
    for (const [k, w] of windows) {
      if (w.hits.every((t) => now - t >= windowMs)) windows.delete(k);
    }
  }
  return { ok: true };
}

/** First IP from X-Forwarded-For, else the direct peer (§9.5 keying). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Test helper — clears all rate-limit windows. */
export function resetRateLimits(): void {
  windows.clear();
}
