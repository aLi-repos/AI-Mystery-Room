import { defineConfig } from "prisma/config";

// Prisma 7 does NOT auto-load `.env` before evaluating this config file
// (verified empirically: `env("DATABASE_URL")` throws without it).
// Node's built-in loader is used so no extra dependency is required (§5.6).
try {
  process.loadEnvFile();
} catch {
  // No `.env` present — CLI commands that need DATABASE_URL will report it.
}

/**
 * The datasource URL, or a placeholder when DATABASE_URL is unset.
 *
 * `prisma generate` (postinstall) never connects to the database, so CI and
 * fresh clones must be able to run it without secrets. Commands that DO need
 * a real database (`migrate deploy`, `db seed`) fail with a connection error
 * against the placeholder instead of a confusing config-load error.
 */
function datasourceUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return "postgresql://user:password@localhost:5432/mysteryai";
}

/**
 * Prisma 7 configuration.
 *
 * Prisma 7 no longer accepts a connection `url` inside `schema.prisma`;
 * the datasource URL lives here instead (Decision: keep Prisma 7.10.1,
 * with `@prisma/adapter-pg` as the runtime driver adapter).
 *
 * The URL is read from `process.env` only — hence the `loadEnvFile()` call
 * above (Prisma 7 no longer auto-loads `.env` before evaluating this file).
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
    url: datasourceUrl(),
  },
});
