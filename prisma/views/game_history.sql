-- game_history VIEW (spec.md §6.2)
-- Managed by hand: Prisma Migrate does not create views. This file is the
-- source of truth for the view definition (referenced by prisma.config.ts
-- `views.path`); the init migration contains the same statement.
CREATE OR REPLACE VIEW "game_history" AS
SELECT
  s.id             AS session_id,
  s.user_id        AS user_id,
  m.title          AS mystery_title,
  s.difficulty     AS difficulty,
  s.status         AS status,
  s.total_score    AS total_score,
  s.hints_used_total AS hints_used_total,
  s.total_attempts AS total_attempts,
  s.correct_attempts AS correct_attempts,
  s.time_used_seconds AS time_used_seconds,
  s.started_at     AS started_at,
  s.completed_at   AS completed_at
FROM game_sessions s
JOIN mysteries m ON m.id = s.mystery_id;
