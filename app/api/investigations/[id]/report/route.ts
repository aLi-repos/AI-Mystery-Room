import { NextResponse, type NextRequest } from "next/server";
import {
  NO_STORE,
  apiError,
  logError,
  newRequestId,
  unauthorized,
} from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";
import { generateReport } from "@/lib/ai/investigation";
import { loadEvidenceInputs, loadFindingsDigest } from "@/lib/investigation/loadEvidence";

type QaEntry = { question: string; answer: string };

/**
 * POST /api/investigations/[id]/report — generate + persist a structured
 * Markdown report grounded in stored findings and evidence. Re-uses the last
 * generated report (GET returns it) until regenerated here.
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
      select: { id: true, caseDescription: true, qaHistory: true },
    });
    if (!investigation) return apiError(404, "NOT_FOUND", "Investigation not found");

    const evidenceInputs = await loadEvidenceInputs(id);
    const findingsDigest = await loadFindingsDigest(id);
    const missingEvidence = await db.finding.findMany({
      where: { investigationId: id, kind: "missing_evidence" },
      select: { statement: true },
    });
    const qaHistory: QaEntry[] = Array.isArray(investigation.qaHistory)
      ? (investigation.qaHistory as QaEntry[])
      : [];

    const report = await generateReport({
      caseDescription: investigation.caseDescription,
      evidence: evidenceInputs,
      findingsDigest,
      missingEvidence: missingEvidence.map((m) => m.statement),
      qaHistory,
    });
    if (!report) {
      return apiError(
        503,
        "AI_UNAVAILABLE",
        "Report generation is unavailable right now. No report was created.",
      );
    }

    await db.investigation.update({
      where: { id },
      data: { report, reportGeneratedAt: new Date() },
    });

    return NextResponse.json(
      { report, generatedAt: new Date().toISOString() },
      { headers: { ...NO_STORE } },
    );
  } catch (error) {
    logError(requestId, "investigations.report", error);
    return apiError(500, "INTERNAL", "Report generation failed");
  }
}
