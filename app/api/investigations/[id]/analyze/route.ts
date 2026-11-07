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
import { analyzeCase, type AnalysisFinding } from "@/lib/ai/investigation";
import { loadEvidenceInputs } from "@/lib/investigation/loadEvidence";

const bodySchema = z.object({
  requirements: z.array(z.string().trim().min(1).max(300)).max(10).optional(),
});

/**
 * POST /api/investigations/[id]/analyze — run AI analysis.
 *
 * Anti-fabrication: evidenceRefs returned by the model are validated against
 * actually-uploaded evidence; unknown refs are dropped before persisting.
 * Previous findings are replaced (fresh analysis of current evidence set).
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
      select: { id: true, caseDescription: true },
    });
    if (!investigation) return apiError(404, "NOT_FOUND", "Investigation not found");

    const evidenceInputs = await loadEvidenceInputs(id);
    if (evidenceInputs.length === 0) {
      return apiError(400, "NO_EVIDENCE", "Upload evidence before running analysis.");
    }

    const result = await analyzeCase({
      caseDescription: investigation.caseDescription,
      evidence: evidenceInputs,
      requirements: parsed.data.requirements,
    });
    if (!result) {
      return apiError(
        503,
        "AI_UNAVAILABLE",
        "AI analysis is unavailable right now. No findings were generated.",
      );
    }

    // Validate refs against real evidence (drop hallucinated refs).
    const refToId = new Map(evidenceInputs.map((e) => [e.ref, e.id]));
    const validIds = new Set(evidenceInputs.map((e) => e.id));
    const sanitized: AnalysisFinding[] = result.findings.map((f) => ({
      ...f,
      evidenceRefs: f.evidenceRefs.filter((r) => refToId.has(r)),
    }));
    const findingsWithIds = sanitized.map((f) => ({
      kind: f.kind,
      statement: f.statement,
      timeLabel: f.timeLabel,
      evidenceIds: f.evidenceRefs.map((r) => refToId.get(r)!).filter((v) => validIds.has(v)),
      confidence: f.confidence,
    }));

    // Fresh analysis replaces previous findings atomically.
    await db.$transaction(async (tx) => {
      await tx.finding.deleteMany({ where: { investigationId: id } });
      if (findingsWithIds.length > 0) {
        await tx.finding.createMany({
          data: findingsWithIds.map((f) => ({ ...f, investigationId: id })),
        });
      }
      await tx.evidence.updateMany({
        where: { investigationId: id, status: "stored" },
        data: { status: "analyzed" },
      });
      await tx.investigation.update({
        where: { id },
        data: { updatedAt: new Date() },
      });
    });

    const findings = await db.finding.findMany({
      where: { investigationId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(
      {
        summary: result.summary,
        missingEvidence: result.missingEvidence,
        findings: findings.map((f) => ({
          id: f.id,
          kind: f.kind,
          statement: f.statement,
          timeLabel: f.timeLabel,
          confidence: f.confidence,
          evidenceRefs: f.evidenceIds
            .map((eid) => evidenceInputs.find((e) => e.id === eid)?.ref)
            .filter(Boolean),
        })),
      },
      { headers: { ...NO_STORE } },
    );
  } catch (error) {
    logError(requestId, "investigations.analyze", error);
    return apiError(500, "INTERNAL", "Analysis failed");
  }
}
