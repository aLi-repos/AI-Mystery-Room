import { NextResponse, type NextRequest } from "next/server";
import { NO_STORE, apiError, logError, newRequestId, unauthorized } from "@/lib/api";
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
        scoreBreakdown: true,
        stageProgress: { include: { stage: true } },
        playerAnswers: true,
      },
    });
    if (!session) return apiError(404, "SESSION_NOT_FOUND", "Session not found");
    return NextResponse.json({ result: session }, { headers: { ...NO_STORE } });
  } catch (e) {
    logError(requestId, "sessions.result", e);
    return apiError(500, "INTERNAL", "Failed to load result");
  }
}
