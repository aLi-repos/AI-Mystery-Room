/**
 * Difficulty session profiles (spec.md §2B) — applied per session, stored in
 * code, NOT in the `mysteries` row (§6.2), so the single MVP mystery (D4)
 * plays identically on Easy/Medium/Hard (D11).
 *
 * P2 ships the profile table because GET /api/mysteries/:id must expose it
 * (§7.3). Scoring formulas that consume these values are built in P3 (D11).
 */
export type Difficulty = "easy" | "medium" | "hard";

export type DifficultyProfile = {
  timeLimitSeconds: number;
  basePoints: number;
  completionBonus: number;
  hintPenaltyPercent: number;
  theoreticalMaxScore: number;
};

export const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  easy: {
    timeLimitSeconds: 20 * 60,
    basePoints: 100,
    completionBonus: 100,
    hintPenaltyPercent: 0.1,
    theoreticalMaxScore: 700,
  },
  medium: {
    timeLimitSeconds: 30 * 60,
    basePoints: 150,
    completionBonus: 200,
    hintPenaltyPercent: 0.1,
    theoreticalMaxScore: 1100,
  },
  hard: {
    timeLimitSeconds: 45 * 60,
    basePoints: 200,
    completionBonus: 300,
    hintPenaltyPercent: 0.1,
    theoreticalMaxScore: 1500,
  },
};

/** All difficulties in display order. */
export const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];
