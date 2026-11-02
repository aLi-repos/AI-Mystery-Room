/** Resolves the server-side session secret (§5.5 `AUTH_SECRET`, §9.1). */
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set — cannot sign or verify sessions");
  }
  return secret;
}
