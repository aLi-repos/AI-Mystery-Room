/**
 * Verification: Prisma schema validity + migration/schema consistency.
 *
 * REAL checks (no database required):
 *  - `prisma validate` against prisma/schema.prisma,
 *  - offline regeneration of the DDL via `prisma migrate diff` must be a
 *    subset of the committed baseline migration (i.e. every generated
 *    statement exists in the migration file; the migration may contain extra
 *    custom SQL for extensions/CHECKs/partial indexes/VIEW).
 *
 * NOTE: this does NOT apply the migration to a database — no PostgreSQL is
 * available in the P2 environment. Application is verified only structurally.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");
const migrationFile = path.join(
  root,
  "prisma",
  "migrations",
  "20261101000000_init_mvp_schema",
  "migration.sql",
);

function prisma(args: string[]): string {
  return execFileSync(process.execPath, [prismaCli, ...args], {
    cwd: root,
    encoding: "utf8",
    // `validate` / `migrate diff --from-empty` never connect to the database,
    // but Prisma's config requires DATABASE_URL to RESOLVE (a dummy URL
    // suffices; empty string counts as unset and fails config loading).
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://dummy:dummy@localhost:5432/mysteryai",
    },
  });
}

/** Splits a SQL script into normalized, non-comment statements. */
function statements(sql: string): string[] {
  return sql
    .split(/;\s*$/m)
    .map((statement) =>
      statement
        .replace(/^--.*$/gm, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((statement) => statement.length > 0);
}

describe("Prisma schema + migration (real CLI, offline)", () => {
  it("prisma/schema.prisma validates", () => {
    const output = prisma(["validate"]);
    expect(output).toContain("is valid");
  });

  it("regenerated DDL is a subset of the committed baseline migration", () => {
    const generated = prisma([
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema=prisma/schema.prisma",
      "--script",
    ]);

    const migrationSql = fs.readFileSync(migrationFile, "utf8");

    const migrationStatements = new Set(statements(migrationSql));
    const missing = statements(generated).filter(
      (statement) => !migrationStatements.has(statement),
    );

    // Every statement Prisma generates from the schema must exist verbatim in
    // the migration; the migration additionally holds custom SQL (extensions,
    // CHECK constraints, partial indexes, the VIEW) that schema syntax cannot
    // express — that asymmetry is expected and documented in the file header.
    expect(missing, `missing from migration.sql:\n${missing.join("\n")}`).toEqual(
      [],
    );
  });

  it("migration contains the custom objects schema syntax cannot express", () => {
    const sql = fs.readFileSync(migrationFile, "utf8");
    // citext + pgcrypto extensions
    expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS citext/);
    expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS pgcrypto/);
    // guest password CHECK (§6.2)
    expect(sql).toContain("users_guest_password_check");
    // case-insensitive unique e-mail, excluding NULLs (guests)
    expect(sql).toMatch(/users_email_lower_key[\s\S]*lower\("email"\)[\s\S]*WHERE "email" IS NOT NULL/);
    // one active session per (user, mystery)
    expect(sql).toMatch(/game_sessions_active_user_mystery_key[\s\S]*WHERE "status" = 'in_progress'/);
    // hint levels constrained to 1..3
    expect(sql).toContain("hints_level_check");
    // multiple_choice 4-option CHECK
    expect(sql).toContain("stages_multiple_choice_options_check");
    // game_history VIEW
    expect(sql).toMatch(/CREATE OR REPLACE VIEW "game_history"/);
  });

  it("migration enforces scores are never negative", () => {
    const sql = fs.readFileSync(migrationFile, "utf8");
    expect(sql).toContain("game_sessions_total_score_check");
    expect(sql).toContain("score_breakdowns_total_check");
    expect(sql).toContain("stage_progress_points_awarded_check");
  });
});
