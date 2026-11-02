import { getPrisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Deterministic credential verification (spec.md §7.1, §9.2).
 *
 * Shared by the NextAuth Credentials provider and POST /api/auth/login so
 * both paths enforce identical rules:
 *  - only registered (non-guest) accounts may log in with a password,
 *  - bcrypt comparison against the stored hash (cost ≥ 12),
 *  - the same generic failure for unknown e-mail and wrong password.
 */
export async function authenticate(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const db = getPrisma();
  const user = await db.user.findFirst({
    where: { email, isGuest: false },
  });
  if (!user || !user.passwordHash) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    isGuest: false,
  };
}
