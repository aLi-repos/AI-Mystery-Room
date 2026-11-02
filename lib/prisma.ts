import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/prisma/generated/client/client";

/**
 * Prisma singleton (spec.md §6/§9.8), created lazily.
 *
 * Prisma 7 requires a driver adapter: `new PrismaClient({ adapter })` with
 * `@prisma/adapter-pg` (approved deviation from §5.6, see prisma.config.ts).
 * The connection string is read server-side only — never exposed to the
 * client. Lazy creation keeps `next build` and unit tests working when
 * DATABASE_URL is absent (the API reports a typed error at request time).
 */
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set — database access unavailable");
    }
    globalForPrisma.__prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }
  return globalForPrisma.__prisma;
}

/** True when a database connection has been configured (§5.5). */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
