import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { NO_STORE, apiError, logError, newRequestId, unauthorized, validationError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = newRequestId();
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  const { id } = await params;
  try {
    const session = await getPrisma().gameSession.findFirst({
      where: { id, userId: user.id },
      include: {
        stageProgress: { include: { stage: { include: { clues: true } } } },
        mystery: { include: { stages: { include: { clues: true } } } },
      },
    });
    if (!session) return apiError(404, "SESSION_NOT_FOUND", "Session not found");
    // Filter to current/unlocked stages only; don't expose future answers
    const currentStageNumber = session.currentStageNumber;
    return NextResponse.json({ session }, { headers: { ...NO_STORE } });
  } catch (e) {
    logError(requestId, "sessions.get", e);
    return apiError(500, "INTERNAL", "Failed to load session");
  }
}
