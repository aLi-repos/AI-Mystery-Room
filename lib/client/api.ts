/**
 * Minimal typed fetch helper for the auth forms (spec.md §5.4 envelope).
 * Client-side only — no secrets ever reach this bundle (§9.3).
 */

export type ApiBody =
  | { user?: { id: string; displayName: string; email: string | null; isGuest?: boolean } }
  | { error?: { code: string; message: string; details?: Record<string, unknown> } }
  | null;

export async function postJson(
  path: string,
  payload: unknown,
): Promise<{ ok: boolean; status: number; body: ApiBody }> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => null)) as ApiBody;
    return { ok: response.ok, status: response.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

export function apiErrorMessage(body: ApiBody, fallback: string): string {
  if (body && "error" in body && body.error) return body.error.message;
  return fallback;
}
