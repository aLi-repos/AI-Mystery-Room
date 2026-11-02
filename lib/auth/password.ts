import bcrypt from "bcryptjs";

/**
 * Password hashing (spec.md §9.2): bcrypt cost ≥ 12, passwords never logged,
 * never stored or returned in plaintext.
 *
 * bcrypt truncates input at 72 bytes — longer passwords are rejected by the
 * Zod schema (§9.6 length validation) so hashing is never lossy.
 */
export const BCRYPT_COST = 12;

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_COST);
}

/** Constant-time-ish bcrypt comparison; `false` on any malformed hash. */
export async function verifyPassword(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  if (!passwordHash) return false;
  try {
    return await bcrypt.compare(plainPassword, passwordHash);
  } catch {
    return false;
  }
}

/**
 * Basic strength check (§9.2): ≥ 8 chars, mixes letters with a digit or
 * symbol, and is not a single repeated character.
 */
export function isStrongPassword(password: string): boolean {
  if (password.length < 8 || password.length > 72) return false;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasOther = /[^A-Za-z]/.test(password);
  const varied = new Set(password).size >= 4;
  return hasLetter && hasOther && varied;
}
