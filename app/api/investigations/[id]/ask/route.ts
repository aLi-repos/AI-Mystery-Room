import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  NO_STORE,
  apiError,
  fieldIssues,
  logError,
  newRequestId,
  unauthorized,
  validationError,
} from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";
import { answerQuestion } from "@/lib/ai/investigation";
import { loadEvidenceInputs, loadFindingsDigest } from "@/lib/investigation/loadEvidence";

const bodySchema = z.object({ question: z.string().trim().min(2).max(2000) });

type QaEntry = { question: string; answer: string; evidenceRefs: string[]; at: string };

/**
 * POST /api/investigations/[id]/ask — follow-up question answering.
 * History (last 8 Q&A pairs) is persisted on the investigation so follow-up
 * questions keep context. Refs are validated against real evidence.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = newRequestId();
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError({ body: fieldIssues(parsed.error) });

  try {
    const db = getPrisma();
    const investigation = await db.investigation.findFirst({
      where: { id, userId: user.id },
      select: { id: true, caseDescription: true, qaHistory: true },
    });
    if (!investigation) return apiError(404, "NOT_FOUND", "Investigation not found");

    const history: QaEntry[] = Array.isArray(investigation.qaHistory)
      ? (investigation.qaHistory as QaEntry[])
      : [];

    const evidenceInputs = await loadEvidenceInputs(id);
    const findingsDigest = await loadFindingsDigest(id);

    const result = await answerQuestion({
      caseDescription: investigation.caseDescription,
      evidence: evidenceInputs,
      findingsDigest,
      question: parsed.data.question,
      history: history.map((h) => ({ question: h.question, answer: h.answer })),
    });
    if (!result) {
      return apiError(503, "AI_UNAVAILABLE", "AI is unavailable right now. Please try again.");
    }

    const refToId = new Map(evidenceInputs.map((e) => [e.ref, e.id]));
    const evidenceIds = result.evidenceRefs
      .filter((r) => refToId.has(r))
      .map((r) => refToId.get(r)!);

    const entry: QaEntry = {
      question: parsed.data.question,
      answer: result.answer,
      evidenceRefs: result.evidenceRefs.filter((r) => refToId.has(r)),
      at: new Date().toISOString(),
    };
    const nextHistory = [...history, entry].slice(-8);
    await db.investigation.update({
      where: { id },
      data: { qaHistory: nextHistory },
    });

    return NextResponse.json(
      {
        answer: result.answer,
        evidenceRefs: entry.evidenceRefs,
        evidenceIds,
        history: nextHistory,
      },
      { headers: { ...NO_STORE } },
    );
  } catch (error) {
    logError(requestId, "investigations.ask", error);
    return apiError(500, "INTERNAL", "Question failed");
  }
}
