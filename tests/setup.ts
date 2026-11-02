/**
 * Vitest global setup (spec.md §14 P2 test plan).
 *
 * Ensures deterministic, hermetic runs:
 *  - AUTH_SECRET is always set so session issue/verify works offline,
 *  - DATABASE_URL is present only if the developer set one; DB-touching unit
 *    tests use a mocked Prisma client (clearly labelled in each suite) so the
 *    suite passes with or without a real database.
 */
process.env.AUTH_SECRET ??=
  "vitest-only-secret-not-for-production-0123456789abcdef";
process.env.NEXTAUTH_URL ??= "http://localhost:3000";
