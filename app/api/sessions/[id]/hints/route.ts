import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { NO_STORE, apiError, logError, newRequestId, unauthorized, validationError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";

const bodySchema = z.object({ stageId: z.string().uuid() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed || !parsed.success) return validationError({ body: "Invalid payload" });
  const { stageId } = parsed.data;
  try {
    const db = getPrisma();
    const session = await db.gameSession.findFirst({ where: { id, userId: user.id, status: "in_progress" } });
    if (!session) return apiError(404, "SESSION_NOT_FOUND", "Active session not found");
    const progress = await db.stageProgress.findFirst({ where: { sessionId: id, stageId } });
    if (!progress) return apiError(404, "STAGE_NOT_FOUND", "Stage not found for session");
    if (progress.hintsUsed >= 3) return apiError(400, "HINT_LIMIT", "Max hints used");
    const nextLevel = progress.hintsUsed + 1;
    // Try static fallback first, then AI if configured
    const staticHint = await db.hint.findFirst({ where: { stageId, level: nextLevel } });
    const aiHint = await db.aiHintCache.findFirst({ where: { stageId, level: nextLevel } });
    let content: string;
    let source: "static" | "ai" = "static";
    if (aiHint) {
      content = aiHint.content;
      source = "ai";
    } else if (staticHint) {
      content = staticHint.content;
      source = "static";
    } else {
      content = "No additional hint available for this stage.";
    }
    await db.stageProgress.update({ where: { id: progress.id }, data: { hintsUsed: { increment: 1 } } });
    await db.gameSession.update({ where: { id }, data: { hintsUsedTotal: { increment: 1 } } });
    return NextResponse.json({ hint: { level: nextLevel, content, source } }, { headers: { ...NO_STORE } });
  } catch (e) {
    logError(requestId, "sessions.hints", e);
    return apiError(500, "INTERNAL", "Failed to get hint");
  }
}
