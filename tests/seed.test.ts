/**
 * Verification: mystery content integrity (D10 five stages) + seed
 * repeatability (§14 P2: "seed validation checks green").
 *
 * Content checks are PURE (no database).
 * Seed repeatability uses an in-memory fake Prisma client — MOCKED DB.
 * The real-DB seed run is blocked by the missing PostgreSQL in this
 * environment (documented in the P2 report): `npm run db:seed` loads the
 * script and fails at connection time only.
 */
import { describe, expect, it } from "vitest";
import {
  MVP_MYSTERY,
  SeedValidationError,
  validateMysteryData,
} from "@/prisma/seed-data";
import { runSeed } from "@/prisma/seed";
import { createFakeDb, type FakeDb } from "./helpers/fakePrisma";

describe("MVP mystery content (D9/D10) — pure validation", () => {
  it("passes every seed-time consistency check", () => {
    expect(validateMysteryData(MVP_MYSTERY)).toEqual([]);
  });

  it("has exactly 5 contiguous stages", () => {
    expect(MVP_MYSTERY.stages).toHaveLength(5);
    expect(MVP_MYSTERY.stageCount).toBe(5);
    expect(MVP_MYSTERY.stages.map((s) => s.stageNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it("exercises at least 3 distinct puzzle types (AC13)", () => {
    const types = new Set(MVP_MYSTERY.stages.map((s) => s.puzzleType));
    expect(types.size).toBeGreaterThanOrEqual(3);
  });

  it("seeds 3 static hints (levels 1–3) and 1 answer key per stage", () => {
    for (const stage of MVP_MYSTERY.stages) {
      expect(stage.hints.map((h) => h.level)).toEqual([1, 2, 3]);
      expect(stage.answer.canonicalAnswer.length).toBeGreaterThan(0);
      expect(stage.clues.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("never leaks a canonical answer into player-facing text (§9.6)", () => {
    for (const stage of MVP_MYSTERY.stages) {
      const text = [
        stage.narrative,
        stage.puzzlePrompt,
        ...stage.clues.map((c) => c.content),
      ]
        .join("\n")
        .toLowerCase();
      expect(text).not.toContain(stage.answer.canonicalAnswer);
    }
  });

  it("the validator actually detects an injected leak (guard is live)", () => {
    const tampered = structuredClone(MVP_MYSTERY);
    const stage = tampered.stages[0];
    stage.clues[0].content += ` The answer is ${stage.answer.canonicalAnswer}.`;
    const problems = validateMysteryData(tampered);
    expect(problems.some((p) => p.includes("leaks"))).toBe(true);
  });

  it("the validator detects duplicate answers across stages", () => {
    const tampered = structuredClone(MVP_MYSTERY);
    tampered.stages[1].answer = structuredClone(tampered.stages[0].answer);
    const problems = validateMysteryData(tampered);
    expect(problems.some((p) => p.includes("duplicate"))).toBe(true);
  });
});

describe("Seed script — repeatable upserts (MOCKED DB)", () => {
  async function seedCounts(db: FakeDb) {
    const stagesWithIncludes = await db.stage.findMany({
      include: { hints: true },
    });
    return {
      mysteries: (await db.mystery.findMany()).length,
      stages: (await db.stage.findMany()).length,
      hints: stagesWithIncludes.reduce(
        (sum, stage) => sum + ((stage.hints as unknown[]) ?? []).length,
        0,
      ),
      answers: (await (db as any).stageAnswer.findMany()).length,
      clues: (await (db as any).clue.findMany()).length,
    };
  }

  it("produces the required row counts on first run", async () => {
    const db = createFakeDb();
    const report = await runSeed(db as any);

    expect(report.stages).toBe(5);
    expect(report.hints).toBe(15); // 5 stages × 3 hints
    expect(report.answers).toBe(5); // 1 answer key per stage
    expect(report.validation).toBe("passed");

    const counts = await seedCounts(db);
    expect(counts).toEqual({
      mysteries: 1,
      stages: 5,
      hints: 15,
      answers: 5,
      clues: expect.any(Number) as unknown as number,
    });
    expect(counts.clues).toBeGreaterThanOrEqual(5); // ≥1 clue per stage
  });

  it("running twice does NOT create duplicates (upsert idempotency)", async () => {
    const db = createFakeDb();
    await runSeed(db as any);
    const first = await seedCounts(db);

    const secondReport = await runSeed(db as any);
    const second = await seedCounts(db);

    expect(second).toEqual(first);
    expect(secondReport.mysteryId).toBeTruthy();
    expect(secondReport.stages).toBe(5);
    expect(second.mysteries).toBe(1);
    expect(second.stages).toBe(5);
    expect(second.hints).toBe(15);
    expect(second.answers).toBe(5);
  });

  it("three consecutive runs stay stable", async () => {
    const db = createFakeDb();
    await runSeed(db as any);
    await runSeed(db as any);
    const before = await seedCounts(db);
    await runSeed(db as any);
    expect(await seedCounts(db)).toEqual(before);
  });

  it("throws SeedValidationError for a mystery failing the checks", async () => {
    const broken = structuredClone(MVP_MYSTERY);
    broken.stages[0].hints = broken.stages[0].hints.slice(0, 2);
    const problems = validateMysteryData(broken);
    expect(problems.length).toBeGreaterThan(0);
    expect(new SeedValidationError(problems).problems).toBe(problems);
  });
});
