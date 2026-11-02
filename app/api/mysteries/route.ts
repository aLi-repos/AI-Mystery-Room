import { NextResponse, type NextRequest } from "next/server";
import { NO_STORE, apiError, logError, newRequestId, unauthorized } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";

/**
 * GET /api/mysteries (spec.md §7.3) — session required.
 * MVP returns the one published mystery (D4); the shape is catalog-ready.
 * `bestScoreByMe` is the player's best completed score for each mystery.
 */
export async function GET(request: NextRequest) {
  // Reads `request.cookies` for session verification → automatically dynamic
  // (build-time prerendering stops on request-property access, Next 16 docs).
  const requestId = newRequestId();

  const user = await getSessionUser(request);
  if (!user) return unauthorized();

  try {
    const db = getPrisma();

    const mysteries = await db.mystery.findMany({
      where: { status: "published" },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    const bestScores = await db.gameSession.groupBy({
      by: ["mysteryId"],
      where: { userId: user.id, status: "completed" },
      _max: { totalScore: true },
    });
    const bestByMystery = new Map(
      bestScores.map((row) => [row.mysteryId, row._max.totalScore ?? 0]),
    );

    const items = mysteries.map((mystery) => ({
      id: mystery.id,
      title: mystery.title,
      tagline: mystery.tagline,
      setting: mystery.setting,
      supportedDifficulties: mystery.supportedDifficulties,
      stageCount: mystery.stageCount,
      estimatedMinutes: mystery.estimatedMinutes,
      bestScoreByMe: bestByMystery.get(mystery.id) ?? null,
    }));

    return NextResponse.json({ items }, { headers: { ...NO_STORE } });
  } catch (error) {
    logError(requestId, "mysteries.list", error);
    return apiError(500, "INTERNAL", "Something went wrong");
  }
}
