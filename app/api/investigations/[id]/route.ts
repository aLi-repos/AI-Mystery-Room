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
import { EVIDENCE_CATEGORIES } from "@/lib/investigation/evidence";

const patchSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  caseDescription: z.string().trim().min(10).max(50_000).optional(),
  categories: z
    .array(z.enum(EVIDENCE_CATEGORIES))
    .min(1)
    .max(6)
    .refine((c) => new Set(c).size === c.length, "duplicates not allowed")
    .optional(),
});

/** Loads an investigation only if it belongs to the session user. */
async function loadOwned(id: string, userId: string) {
  const db = getPrisma();
  return db.investigation.findFirst({ where: { id, userId } });
}

/** GET /api/investigations/[id] — full case state (metadata only, no bytes). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = newRequestId();
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  const { id } = await params;
  try {
    const investigation = await loadOwned(id, user.id);
    if (!investigation) return apiError(404, "NOT_FOUND", "Investigation not found");

    const db = getPrisma();
    const [evidence, findings] = await Promise.all([
      db.evidence.findMany({
        where: { investigationId: id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          ref: true,
          category: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          status: true,
          processNote: true,
          createdAt: true,
        },
      }),
      db.finding.findMany({
        where: { investigationId: id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          kind: true,
          statement: true,
          timeLabel: true,
          evidenceIds: true,
          confidence: true,
        },
      }),
    ]);

    const refById = new Map(evidence.map((e) => [e.id, e.ref]));

    return NextResponse.json(
      {
        id: investigation.id,
        title: investigation.title,
        caseDescription: investigation.caseDescription,
        categories: investigation.categories,
        report: investigation.report,
        reportGeneratedAt: investigation.reportGeneratedAt,
        qaHistory: investigation.qaHistory,
        createdAt: investigation.createdAt,
        updatedAt: investigation.updatedAt,
        evidence,
        findings: findings.map((f) => ({
          ...f,
          // Resolve evidence uuids → display refs for the UI.
          evidenceRefs: f.evidenceIds.map((eid) => refById.get(eid)).filter(Boolean),
        })),
      },
      { headers: { ...NO_STORE } },
    );
  } catch (error) {
    logError(requestId, "investigations.detail", error);
    return apiError(500, "INTERNAL", "Something went wrong");
  }
}

/** PATCH /api/investigations/[id] — edit case description/title/categories. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = newRequestId();
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError({ body: fieldIssues(parsed.error) });
  try {
    const existing = await loadOwned(id, user.id);
    if (!existing) return apiError(404, "NOT_FOUND", "Investigation not found");
    const db = getPrisma();
    await db.investigation.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ ok: true }, { headers: { ...NO_STORE } });
  } catch (error) {
    logError(requestId, "investigations.update", error);
    return apiError(500, "INTERNAL", "Failed to update investigation");
  }
}

/** DELETE /api/investigations/[id] — cascades to evidence + findings. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = newRequestId();
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  const { id } = await params;
  try {
    const existing = await loadOwned(id, user.id);
    if (!existing) return apiError(404, "NOT_FOUND", "Investigation not found");
    const db = getPrisma();
    await db.investigation.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { headers: { ...NO_STORE } });
  } catch (error) {
    logError(requestId, "investigations.delete", error);
    return apiError(500, "INTERNAL", "Failed to delete investigation");
  }
}
