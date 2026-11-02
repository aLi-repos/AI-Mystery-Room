import type { DefaultSession } from "next-auth";

/**
 * next-auth v4 module augmentation (spec.md §9.1): the session carries the
 * application user id and the guest flag so every protected route can make
 * ownership decisions server-side.
 */
declare module "next-auth" {
  interface Session {
    user: { id: string; isGuest: boolean } & DefaultSession["user"];
  }

  interface User {
    isGuest?: boolean;
  }
}

export {};
