import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { NO_STORE, apiError, fieldIssues, logError, newRequestId, unauthorized, validationError } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { DIFFICULTY_PROFILES } from "@/lib/game/difficultyProfiles";
import { getPrisma } from "@/lib/prisma";

/**
 * GET /api/mysteries/:id (spec.md §7.3) — session required.
 *
 * Returns catalog + difficulty-profile metadata only. Deliberately excluded:
 * stage content, explanations and anything from `stage_answers`
 * (answer-leak guard, §9.4/§9.6).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Session verification reads `request.cookies` → dynamic per request
  // without `connection()` (Next 16 route-handler docs).
  const requestId = newRequestId();

  const user = await getSessionUser(request);
  if (!user) return unauthorized();

  const { id } = await params;
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) {
    return validationError({ id: fieldIssues(parsedId.error)["_"] ?? "Invalid id" });
  }

  try {
    const mystery = await getPrisma().mystery.findFirst({
      where: { id: parsedId.data, status: "published" },
    });
    if (!mystery) {
      return apiError(404, "MYSTERY_NOT_FOUND", "Mystery not found");
    }

    return NextResponse.json(
      {
        id: mystery.id,
        title: mystery.title,
        tagline: mystery.tagline,
        setting: mystery.setting,
        theme: mystery.theme,
        stageCount: mystery.stageCount,
        estimatedMinutes: mystery.estimatedMinutes,
        supportedDifficulties: mystery.supportedDifficulties,
        difficultyProfiles: DIFFICULTY_PROFILES,
      },
      { headers: { ...NO_STORE } },
    );
  } catch (error) {
    logError(requestId, "mysteries.detail", error);
    return apiError(500, "INTERNAL", "Something went wrong");
  }
}
