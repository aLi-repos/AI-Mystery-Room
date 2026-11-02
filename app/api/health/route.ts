import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma";
import pkg from "@/package.json";

// Operational health check — spec.md §7.8.
//
// `db` states:
//  - "ok"           — a lightweight SELECT 1 probe succeeded,
//  - "not_configured" — no DATABASE_URL (e.g. local UI work without Postgres),
//  - "error"        — configured but the probe failed (§9.10: report, don't crash).
// `aiProvider` stays "disabled" until the Gemini adapter lands in P4.
//
// `cacheComponents` is enabled (see next.config.ts) and segment config exports
// like `dynamic = "force-dynamic"` are not allowed with it. `await connection()`
// is the Next 16 way to make this handler evaluate per request instead of being
// prerendered at build time (see node_modules/next/dist/docs, route handlers).
export async function GET() {
  await connection();

  let db: "ok" | "not_configured" | "error" = "not_configured";
  if (isDatabaseConfigured()) {
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      db = "ok";
    } catch {
      db = "error";
    }
  }

  return NextResponse.json({
    ok: true,
    db,
    aiProvider: "disabled",
    version: pkg.version,
  });
}
