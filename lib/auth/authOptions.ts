import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authenticate } from "@/lib/auth/authorize";
import {
  SESSION_MAX_AGE_SECONDS,
  sessionCookieName,
  useSecureCookies,
} from "@/lib/auth/cookies";
import "./types";

/**
 * NextAuth v4 configuration (spec.md §9.1).
 *
 * Compatibility with Next 16 was verified in P2: next-auth@4.24.15 declares
 * `next: ^16` in its peerDependencies and its App Router handler is mounted at
 * `app/api/auth/[...nextauth]/route.ts`. The MVP's user-facing auth flows use
 * the spec §7.1 endpoints (register/login/logout/me/guest/upgrade-guest),
 * which share this configuration: same secret, same cookie name/flags, same
 * JWT encode/decode, and the same Credentials verification logic.
 */
export const authOptions: NextAuthOptions = {
  // Read at request time (not module load) so `next build` succeeds without
  // env vars; a missing secret surfaces as a typed error on first use.
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS, // §9.9 — 7-day absolute sessions
  },
  useSecureCookies: useSecureCookies(),
  cookies: {
    sessionToken: {
      name: sessionCookieName(),
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: useSecureCookies(),
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await authenticate(credentials.email, credentials.password);
        if (!user) return null;
        return {
          id: user.id,
          name: user.displayName,
          email: user.email ?? undefined,
          isGuest: user.isGuest,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isGuest = user.isGuest === true;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = (typeof token.id === "string" ? token.id : token.sub) as string;
      session.user.isGuest = token.isGuest === true;
      return session;
    },
  },
};
