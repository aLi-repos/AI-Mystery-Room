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

const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  caseDescription: z.string().trim().min(10).max(50_000),
  categories: z
    .array(z.enum(EVIDENCE_CATEGORIES))
    .min(1)
    .max(6)
    .refine((c) => new Set(c).size === c.length, "duplicates not allowed"),
});

/** GET /api/investigations — the user's investigations (session required). */
export async function GET(request: NextRequest) {
  const requestId = newRequestId();
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  try {
    const db = getPrisma();
    const items = await db.investigation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        categories: true,
        createdAt: true,
        updatedAt: true,
        reportGeneratedAt: true,
        _count: { select: { evidence: true, findings: true } },
      },
    });
    return NextResponse.json(
      {
        items: items.map((i) => ({
          id: i.id,
          title: i.title,
          categories: i.categories,
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
          hasReport: i.reportGeneratedAt !== null,
          evidenceCount: i._count.evidence,
          findingsCount: i._count.findings,
        })),
      },
      { headers: { ...NO_STORE } },
    );
  } catch (error) {
    logError(requestId, "investigations.list", error);
    return apiError(500, "INTERNAL", "Something went wrong");
  }
}

/** POST /api/investigations — create a case (session required). */
export async function POST(request: NextRequest) {
  const requestId = newRequestId();
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return validationError({ body: fieldIssues(parsed.error) });
  }
  try {
    const db = getPrisma();
    const count = await db.investigation.count({ where: { userId: user.id } });
    if (count >= 50) {
      return apiError(409, "LIMIT_REACHED", "Investigation limit reached (50).");
    }
    const created = await db.investigation.create({
      data: {
        userId: user.id,
        title: parsed.data.title,
        caseDescription: parsed.data.caseDescription,
        categories: parsed.data.categories,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: created.id }, { status: 201, headers: { ...NO_STORE } });
  } catch (error) {
    logError(requestId, "investigations.create", error);
    return apiError(500, "INTERNAL", "Failed to create investigation");
  }
}
