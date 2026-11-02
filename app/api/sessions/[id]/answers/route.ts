import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { NO_STORE, apiError, fieldIssues, logError, newRequestId, unauthorized, validationError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";

const bodySchema = z.object({ stageId: z.string().uuid(), answer: z.string().min(1).max(500) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed || !parsed.success) return validationError({ body: "Invalid payload" });
  const { stageId, answer } = parsed.data;
  try {
    const db = getPrisma();
    const session = await db.gameSession.findFirst({ where: { id, userId: user.id, status: "in_progress" } });
    if (!session) return apiError(404, "SESSION_NOT_FOUND", "Active session not found");
    // Check rate limit (simple: max 6 per minute per session tracked in memory; skip for MVP simplicity)
    const progress = await db.stageProgress.findFirst({ where: { sessionId: id, stageId } });
    if (!progress || progress.status === "solved") return apiError(400, "STAGE_INVALID", "Stage not active");
    const stageAnswer = await db.stageAnswer.findUnique({ where: { stageId } });
    if (!stageAnswer) return apiError(404, "ANSWER_NOT_FOUND", "No answer key");
    const normalized = answer.trim().toLowerCase().replace(/[^a-z0-9]/gi, "");
    const accepted = (stageAnswer.acceptedAnswers as string[]).map(a => a.toLowerCase().replace(/[^a-z0-9]/gi, ""));
    const isCorrect = accepted.includes(normalized);
    // Record attempt
    await db.playerAnswer.create({
      data: { sessionId: id, stageId, answerText: answer, isCorrect, evaluatedBy: "deterministic", pointsDelta: isCorrect ? 100 : 0 },
    });
    await db.stageProgress.update({ where: { id: progress.id }, data: { attempts: { increment: 1 }, pointsAwarded: isCorrect ? 100 : 0 } });
    if (isCorrect) {
      await db.stageProgress.update({ where: { id: progress.id }, data: { status: "solved", solvedAt: new Date() } });
      // Unlock next stage if exists
      const stageRow = await db.stage.findFirst({ where: { id: stageId } });
      if (stageRow) {
        const nextStage = await db.stage.findFirst({ where: { mysteryId: stageRow.mysteryId, stageNumber: stageRow.stageNumber + 1 } });
        if (nextStage) {
          await db.stageProgress.updateMany({ where: { sessionId: id, stageId: nextStage.id }, data: { status: "unlocked" } });
          await db.gameSession.update({ where: { id }, data: { currentStageNumber: stageRow.stageNumber + 1 } });
        } else {
          // Completed all stages
          await db.gameSession.update({ where: { id }, data: { status: "completed", completedAt: new Date(), timeUsedSeconds: Math.floor((Date.now() - session.startedAt.getTime()) / 1000) } });
        }
      }
      return NextResponse.json({ correct: true, stageSolved: true, message: "Correct! Stage solved." }, { headers: { ...NO_STORE } });
    } else {
      return NextResponse.json({ correct: false, attempts: progress.attempts + 1, message: "Incorrect. Try again or request a hint." }, { headers: { ...NO_STORE } });
    }
  } catch (e) {
    logError(requestId, "sessions.answers", e);
    return apiError(500, "INTERNAL", "Failed to submit answer");
  }
}
