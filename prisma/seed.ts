import { pathToFileURL } from "node:url";
import type { Prisma } from "@/prisma/generated/client/client";
import {
  MVP_MYSTERY,
  SeedValidationError,
  validateMysteryData,
  type SeedMystery,
} from "@/prisma/seed-data";
import { getPrisma } from "@/lib/prisma";

/**
 * Seed script (spec.md §11 — `prisma db seed`, D9 hybrid authoring output).
 *
 * Repeatable by construction: every write is an upsert keyed on a natural
 * unique (title / (mystery, stage) / (stage, clue) / stage answer /
 * (stage, level)), so running it twice updates in place and NEVER creates
 * duplicates. Validation runs before any write; verification re-reads the
 * rows afterwards (5 stages × 3 hints × 1 answer key).
 *
 * Run: `npx prisma db seed` (configured in prisma.config.ts) or
 * `npx tsx prisma/seed.ts`.
 */

export type SeedTransaction = Prisma.TransactionClient;

export type SeedClient = {
  $transaction<T>(fn: (tx: SeedTransaction) => Promise<T>): Promise<T>;
};

export type SeedReport = {
  mysteryId: string;
  title: string;
  stages: number;
  hints: number;
  answers: number;
  clues: number;
  validation: "passed";
};

export async function runSeed(client: SeedClient): Promise<SeedReport> {
  // 1. Seed-time content validation (§2C) — fail BEFORE touching the DB.
  const problems = validateMysteryData(MVP_MYSTERY);
  if (problems.length > 0) {
    throw new SeedValidationError(problems);
  }

  // 2. Idempotent upserts inside one transaction.
  return client.$transaction(async (tx) => {
    const mystery = await upsertMystery(tx, MVP_MYSTERY);

    for (const stage of MVP_MYSTERY.stages) {
      const stageRow = await tx.stage.upsert({
        where: {
          mysteryId_stageNumber: {
            mysteryId: mystery.id,
            stageNumber: stage.stageNumber,
          },
        },
        update: {
          title: stage.title,
          narrative: stage.narrative,
          puzzleType: stage.puzzleType,
          puzzlePrompt: stage.puzzlePrompt,
          puzzleOptions: stage.puzzleOptions as any,
          explanation: stage.explanation,
        },
        create: {
          mysteryId: mystery.id,
          stageNumber: stage.stageNumber,
          title: stage.title,
          narrative: stage.narrative,
          puzzleType: stage.puzzleType,
          puzzlePrompt: stage.puzzlePrompt,
          puzzleOptions: stage.puzzleOptions as any,
          explanation: stage.explanation,
        },
      });

      for (const clue of stage.clues) {
        await tx.clue.upsert({
          where: {
            stageId_clueNumber: { stageId: stageRow.id, clueNumber: clue.clueNumber },
          },
          update: { content: clue.content },
          create: {
            stageId: stageRow.id,
            clueNumber: clue.clueNumber,
            content: clue.content,
          },
        });
      }

      await tx.stageAnswer.upsert({
        where: { stageId: stageRow.id },
        update: {
          canonicalAnswer: stage.answer.canonicalAnswer,
          acceptedAnswers: stage.answer.acceptedAnswers,
        },
        create: {
          stageId: stageRow.id,
          canonicalAnswer: stage.answer.canonicalAnswer,
          acceptedAnswers: stage.answer.acceptedAnswers,
        },
      });

      for (const hint of stage.hints) {
        await tx.hint.upsert({
          where: { stageId_level: { stageId: stageRow.id, level: hint.level } },
          update: { content: hint.content },
          create: { stageId: stageRow.id, level: hint.level, content: hint.content },
        });
      }
    }

    // 3. Post-write verification (§14 P2 — seed validation checks green).
    return verifySeededMystery(tx, mystery.id);
  });
}

async function upsertMystery(tx: SeedTransaction, data: SeedMystery) {
  return tx.mystery.upsert({
    where: { title: data.title },
    update: {
      tagline: data.tagline,
      setting: data.setting,
      theme: data.theme,
      stageCount: data.stageCount,
      estimatedMinutes: data.estimatedMinutes,
      supportedDifficulties: data.supportedDifficulties,
      source: data.source,
      status: data.status,
    },
    create: {
      title: data.title,
      tagline: data.tagline,
      setting: data.setting,
      theme: data.theme,
      stageCount: data.stageCount,
      estimatedMinutes: data.estimatedMinutes,
      supportedDifficulties: data.supportedDifficulties,
      source: data.source,
      status: data.status,
    },
  });
}

async function verifySeededMystery(
  tx: SeedTransaction,
  mysteryId: string,
): Promise<SeedReport> {
  const problems: string[] = [];

  const stages = await tx.stage.findMany({
    where: { mysteryId },
    orderBy: { stageNumber: "asc" },
    include: { hints: true, clues: true, answer: true },
  });

  if (stages.length !== MVP_MYSTERY.stageCount) {
    problems.push(`expected ${MVP_MYSTERY.stageCount} stage rows, found ${stages.length}`);
  }

  let hints = 0;
  let answers = 0;
  let clues = 0;

  for (const [index, stage] of stages.entries()) {
    if (stage.stageNumber !== index + 1) {
      problems.push(`stage numbering is not contiguous at index ${index}`);
    }
    if (stage.hints.length !== 3) {
      problems.push(`stage ${stage.stageNumber}: expected 3 hints, found ${stage.hints.length}`);
    }
    const levelSet = new Set(stage.hints.map((h) => h.level));
    if (levelSet.size !== 3 || ![1, 2, 3].every((l) => levelSet.has(l))) {
      problems.push(`stage ${stage.stageNumber}: hint levels must be exactly {1,2,3}`);
    }
    if (stage.clues.length < 1) {
      problems.push(`stage ${stage.stageNumber}: needs at least 1 clue`);
    }
    if (!stage.answer) {
      problems.push(`stage ${stage.stageNumber}: missing answer key`);
    } else if (stage.answer.canonicalAnswer !== stage.answer.canonicalAnswer.toLowerCase()) {
      problems.push(`stage ${stage.stageNumber}: canonical answer not lowercased`);
    }
    hints += stage.hints.length;
    answers += stage.answer ? 1 : 0;
    clues += stage.clues.length;
  }

  if (problems.length > 0) {
    throw new SeedValidationError(problems);
  }

  const mystery = await tx.mystery.findUniqueOrThrow({ where: { id: mysteryId } });
  return {
    mysteryId: mystery.id,
    title: mystery.title,
    stages: stages.length,
    hints,
    answers,
    clues,
    validation: "passed",
  };
}

// ---------------------------------------------------------------------------
// CLI entry (executed by `prisma db seed` / `tsx prisma/seed.ts`)
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const report = await runSeed(getPrisma());
  console.log(JSON.stringify({ level: "info", scope: "seed", ...report }));
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error: unknown) => {
    if (error instanceof SeedValidationError) {
      console.error(JSON.stringify({ level: "error", scope: "seed", problems: error.problems }));
    } else {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ level: "error", scope: "seed", message }));
    }
    process.exitCode = 1;
  });
}
