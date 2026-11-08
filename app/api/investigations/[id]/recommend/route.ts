import { NextResponse, type NextRequest } from "next/server";
import { NO_STORE, apiError, logError, newRequestId, unauthorized } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";
import { recommendEvidence } from "@/lib/ai/investigation";

/**
 * POST /api/investigations/[id]/recommend — the AI reads the case story
 * and returns the evidence that should be collected (type + why relevant).
 * `503 AI_UNAVAILABLE` when the provider cannot answer — never faked.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = newRequestId();
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  const { id } = await params;
  try {
    const db = getPrisma();
    const investigation = await db.investigation.findFirst({
      where: { id, userId: user.id },
      select: { caseDescription: true, categories: true },
    });
    if (!investigation) return apiError(404, "NOT_FOUND", "Investigation not found");

    const result = await recommendEvidence(
      investigation.caseDescription,
      investigation.categories,
    );
    if (!result) {
      return apiError(
        503,
        "AI_UNAVAILABLE",
        "AI story analysis is unavailable right now. Try again later.",
      );
    }
    return NextResponse.json(result, { headers: { ...NO_STORE } });
  } catch (error) {
    logError(requestId, "investigations.recommend", error);
    return apiError(500, "INTERNAL", "Failed to analyse the story");
  }
}
