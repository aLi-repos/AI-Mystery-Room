import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { NO_STORE, apiError, fieldIssues, logError, newRequestId, unauthorized, validationError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";
import { DIFFICULTY_PROFILES } from "@/lib/game/difficultyProfiles";

const bodySchema = z.object({
  mysteryId: z.string().uuid(),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export async function POST(request: NextRequest) {
  const requestId = newRequestId();
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed || !parsed.success) return validationError({ body: "Invalid payload" });
  const { mysteryId, difficulty } = parsed.data;
  try {
    const db = getPrisma();
    const mystery = await db.mystery.findUnique({ where: { id: mysteryId, status: "published" } });
    if (!mystery) return apiError(404, "MYSTERY_NOT_FOUND", "Mystery not found");
    // Prevent duplicate active session
    const existing = await db.gameSession.findFirst({
      where: { userId: user.id, mysteryId, status: "in_progress" },
    });
    if (existing) {
      return NextResponse.json({ session: { id: existing.id, currentStageNumber: existing.currentStageNumber, difficulty: existing.difficulty } }, { headers: { ...NO_STORE } });
    }
    const profile = DIFFICULTY_PROFILES[difficulty as "easy" | "medium" | "hard"];
    const session = await db.gameSession.create({
      data: {
        userId: user.id,
        mysteryId,
        difficulty: difficulty as "easy" | "medium" | "hard",
        status: "in_progress",
        currentStageNumber: 1,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + profile.timeLimitSeconds * 1000),
      },
    });
    // Create stage progress rows
    const stages = await db.stage.findMany({ where: { mysteryId }, orderBy: { stageNumber: "asc" } });
    for (const stage of stages) {
      await db.stageProgress.create({
        data: {
          sessionId: session.id,
          stageId: stage.id,
          status: stage.stageNumber === 1 ? "unlocked" : "locked",
          hintsUsed: 0,
          attempts: 0,
          pointsAwarded: 0,
        },
      });
    }
    return NextResponse.json({ session: { id: session.id, currentStageNumber: session.currentStageNumber, difficulty: session.difficulty, expiresAt: session.expiresAt } }, { headers: { ...NO_STORE } });
  } catch (e) {
    logError(requestId, "sessions.create", e);
    return apiError(500, "INTERNAL", "Failed to start session");
  }
}
