import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";

/**
 * NextAuth v4 handler (spec.md §9.1 — "Auth.js credentials").
 *
 * Mounted under `/api/auth/*`; the spec §7.1 endpoints (register, login,
 * logout, me, guest, upgrade-guest) are static routes that take precedence
 * over this catch-all and share the same secret, cookie policy and
 * Credentials verification logic (see lib/auth/authOptions.ts).
 *
 * next-auth@4.24.15 peer-supports `next: ^16` (verified in P2) — no upgrade
 * to the v5 beta was performed.
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
