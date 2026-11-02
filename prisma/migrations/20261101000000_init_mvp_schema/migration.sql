-- MysteryAI initial schema — spec.md §6.2 (phase P2)
--
-- This migration is version-controlled and has NOT been applied to any
-- database: the P2 environment has no PostgreSQL instance or DATABASE_URL
-- (per authorization: prepare + validate without claiming it was applied).
--
-- Structure of this file:
--   1) Generated section — produced by
--        prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
--   2) Custom section — CHECK constraints, partial/expression indexes and the
--      `game_history` VIEW that Prisma schema syntax cannot express.
--
-- Consistency with prisma/schema.prisma is verified offline by
-- tests/migration.test.ts (regenerated diff must be a subset of this file).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "MysterySource" AS ENUM ('static', 'ai');

-- CreateEnum
CREATE TYPE "MysteryStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "PuzzleType" AS ENUM ('multiple_choice', 'text_input', 'numeric_code', 'cipher');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('in_progress', 'completed', 'timed_out', 'abandoned');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('locked', 'unlocked', 'solved');

-- CreateEnum
CREATE TYPE "EvaluatedBy" AS ENUM ('deterministic');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT,
    "password_hash" TEXT,
    "display_name" VARCHAR(40) NOT NULL,
    "is_guest" BOOLEAN NOT NULL DEFAULT false,
    "guest_expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mysteries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(120) NOT NULL,
    "tagline" VARCHAR(200) NOT NULL,
    "setting" VARCHAR(200) NOT NULL,
    "theme" VARCHAR(80) NOT NULL,
    "stage_count" INTEGER NOT NULL,
    "estimated_minutes" INTEGER NOT NULL,
    "supported_difficulties" JSONB NOT NULL DEFAULT '["easy","medium","hard"]',
    "source" "MysterySource" NOT NULL,
    "status" "MysteryStatus" NOT NULL DEFAULT 'draft',
    "created_by" UUID,
    "ai_generation_meta" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mysteries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mystery_id" UUID NOT NULL,
    "stage_number" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "narrative" TEXT NOT NULL,
    "puzzle_type" "PuzzleType" NOT NULL,
    "puzzle_prompt" TEXT NOT NULL,
    "puzzle_options" JSONB,
    "explanation" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stage_id" UUID NOT NULL,
    "clue_number" INTEGER NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "clues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stage_id" UUID NOT NULL,
    "canonical_answer" VARCHAR(200) NOT NULL,
    "accepted_answers" JSONB NOT NULL,

    CONSTRAINT "stage_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stage_id" UUID NOT NULL,
    "level" SMALLINT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "hints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_hint_cache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stage_id" UUID NOT NULL,
    "level" SMALLINT NOT NULL,
    "content" TEXT NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_hint_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "mystery_id" UUID NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'in_progress',
    "current_stage_number" INTEGER NOT NULL DEFAULT 1,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "total_score" INTEGER NOT NULL DEFAULT 0,
    "hints_used_total" SMALLINT NOT NULL DEFAULT 0,
    "correct_attempts" INTEGER NOT NULL DEFAULT 0,
    "total_attempts" INTEGER NOT NULL DEFAULT 0,
    "time_used_seconds" INTEGER,
    "ai_degraded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "status" "StageStatus" NOT NULL DEFAULT 'locked',
    "hints_used" SMALLINT NOT NULL DEFAULT 0,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "points_awarded" INTEGER NOT NULL DEFAULT 0,
    "solved_at" TIMESTAMPTZ,

    CONSTRAINT "stage_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "answer_text" VARCHAR(500) NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "evaluated_by" "EvaluatedBy" NOT NULL DEFAULT 'deterministic',
    "points_delta" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_breakdowns" (
    "session_id" UUID NOT NULL,
    "stage_points_sum" INTEGER NOT NULL,
    "hint_penalty" INTEGER NOT NULL DEFAULT 0,
    "time_bonus" INTEGER NOT NULL DEFAULT 0,
    "completion_bonus" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "rank_label" VARCHAR(40) NOT NULL,

    CONSTRAINT "score_breakdowns_pkey" PRIMARY KEY ("session_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mysteries_title_key" ON "mysteries"("title");

-- CreateIndex
CREATE UNIQUE INDEX "stages_mystery_id_stage_number_key" ON "stages"("mystery_id", "stage_number");

-- CreateIndex
CREATE UNIQUE INDEX "clues_stage_id_clue_number_key" ON "clues"("stage_id", "clue_number");

-- CreateIndex
CREATE UNIQUE INDEX "stage_answers_stage_id_key" ON "stage_answers"("stage_id");

-- CreateIndex
CREATE UNIQUE INDEX "hints_stage_id_level_key" ON "hints"("stage_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "ai_hint_cache_stage_id_level_key" ON "ai_hint_cache"("stage_id", "level");

-- CreateIndex
CREATE INDEX "game_sessions_user_id_created_at_idx" ON "game_sessions"("user_id" DESC, "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "stage_progress_session_id_stage_id_key" ON "stage_progress"("session_id", "stage_id");

-- CreateIndex
CREATE INDEX "player_answers_session_id_created_at_idx" ON "player_answers"("session_id", "created_at");

-- AddForeignKey
ALTER TABLE "mysteries" ADD CONSTRAINT "mysteries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stages" ADD CONSTRAINT "stages_mystery_id_fkey" FOREIGN KEY ("mystery_id") REFERENCES "mysteries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clues" ADD CONSTRAINT "clues_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_answers" ADD CONSTRAINT "stage_answers_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hints" ADD CONSTRAINT "hints_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_hint_cache" ADD CONSTRAINT "ai_hint_cache_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_mystery_id_fkey" FOREIGN KEY ("mystery_id") REFERENCES "mysteries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_progress" ADD CONSTRAINT "stage_progress_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_progress" ADD CONSTRAINT "stage_progress_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_answers" ADD CONSTRAINT "player_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_answers" ADD CONSTRAINT "player_answers_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_breakdowns" ADD CONSTRAINT "score_breakdowns_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- MysteryAI init migration — custom SQL (spec.md §6.2)
--
-- The statements above this section are generated by
--   prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
-- The statements below add everything Prisma schema syntax cannot express:
-- CHECK constraints, partial/expression indexes, the citext extension and
-- the `game_history` VIEW. This file is version-controlled; it has NOT been
-- applied to any database yet (no DATABASE_URL / local PostgreSQL in the P2
-- environment — see the P2 report).

-- citext is required by users.email; pgcrypto provides gen_random_uuid() on
-- PostgreSQL < 13 (a no-op need on 13+, where it is built in).
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- users: guest accounts must never carry a password (§6.2)
ALTER TABLE "users" ADD CONSTRAINT "users_guest_password_check"
  CHECK ("is_guest" = false OR "password_hash" IS NULL);

-- users: case-insensitive unique e-mail; NULL e-mails (guests) are excluded
-- (§6.2 — partial unique index on lower(email) WHERE email IS NOT NULL)
CREATE UNIQUE INDEX "users_email_lower_key"
  ON "users" (lower("email"))
  WHERE "email" IS NOT NULL;

-- mysteries: stage_count must be between 3 and 8 (§6.2; the MVP row is 5,
-- D10 — the seed additionally asserts stage_count == number of stage rows)
ALTER TABLE "mysteries" ADD CONSTRAINT "mysteries_stage_count_check"
  CHECK ("stage_count" >= 3 AND "stage_count" <= 8);

-- stages: stage_number >= 1 (§6.2)
ALTER TABLE "stages" ADD CONSTRAINT "stages_stage_number_check"
  CHECK ("stage_number" >= 1);

-- stages: multiple_choice requires a 4-item options array (§6.2)
ALTER TABLE "stages" ADD CONSTRAINT "stages_multiple_choice_options_check"
  CHECK (
    "puzzle_type" <> 'multiple_choice'
    OR (
      "puzzle_options" IS NOT NULL
      AND jsonb_typeof("puzzle_options") = 'array'
      AND jsonb_array_length("puzzle_options") = 4
    )
  );

-- clues: clue_number >= 1 (§6.2)
ALTER TABLE "clues" ADD CONSTRAINT "clues_clue_number_check"
  CHECK ("clue_number" >= 1);

-- hints / ai_hint_cache: levels are exactly 1..3 (§6.2)
ALTER TABLE "hints" ADD CONSTRAINT "hints_level_check"
  CHECK ("level" IN (1, 2, 3));
ALTER TABLE "ai_hint_cache" ADD CONSTRAINT "ai_hint_cache_level_check"
  CHECK ("level" IN (1, 2, 3));

-- game_sessions: scores never negative (§6.2)
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_total_score_check"
  CHECK ("total_score" >= 0);

-- game_sessions: partial index for the active-session lookup (§6.2)
CREATE INDEX "game_sessions_status_idx"
  ON "game_sessions" ("status")
  WHERE "status" = 'in_progress';

-- game_sessions: exactly one active session per (user, mystery) (§6.2/§6.3)
CREATE UNIQUE INDEX "game_sessions_active_user_mystery_key"
  ON "game_sessions" ("user_id", "mystery_id")
  WHERE "status" = 'in_progress';

-- stage_progress: hint usage capped at 3, points never negative (§6.2)
ALTER TABLE "stage_progress" ADD CONSTRAINT "stage_progress_hints_used_check"
  CHECK ("hints_used" >= 0 AND "hints_used" <= 3);
ALTER TABLE "stage_progress" ADD CONSTRAINT "stage_progress_points_awarded_check"
  CHECK ("points_awarded" >= 0);

-- score_breakdowns: total never negative (§6.2)
ALTER TABLE "score_breakdowns" ADD CONSTRAINT "score_breakdowns_total_check"
  CHECK ("total" >= 0);

-- game_history VIEW (§6.2) — history is a query, not a duplicate table.
-- Canonical copy of this definition: prisma/views/game_history.sql
CREATE OR REPLACE VIEW "game_history" AS
SELECT
  s.id               AS session_id,
  s.user_id          AS user_id,
  m.title            AS mystery_title,
  s.difficulty       AS difficulty,
  s.status           AS status,
  s.total_score      AS total_score,
  s.hints_used_total AS hints_used_total,
  s.total_attempts   AS total_attempts,
  s.correct_attempts AS correct_attempts,
  s.time_used_seconds AS time_used_seconds,
  s.started_at       AS started_at,
  s.completed_at     AS completed_at
FROM game_sessions s
JOIN mysteries m ON m.id = s.mystery_id;
