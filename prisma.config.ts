import { defineConfig, env } from "prisma/config";

// Prisma 7 does NOT auto-load `.env` before evaluating this config file
// (verified empirically: `env("DATABASE_URL")` throws without it).
// Node's built-in loader is used so no extra dependency is required (§5.6).
try {
  process.loadEnvFile();
} catch {
  // No `.env` present — CLI commands that need DATABASE_URL will report it.
}

/**
 * Prisma 7 configuration.
 *
 * Prisma 7 no longer accepts a connection `url` inside `schema.prisma`;
 * the datasource URL lives here instead (Decision: keep Prisma 7.10.1,
 * with `@prisma/adapter-pg` as the runtime driver adapter).
 *
 * `env()` reads `process.env` only — hence the `loadEnvFile()` call above
 * (Prisma 7 no longer auto-loads `.env` before evaluating this file).
 * `.env` / `.env.example` keep the §5.5 names.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  views: {
    path: "prisma/views",
  },
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
