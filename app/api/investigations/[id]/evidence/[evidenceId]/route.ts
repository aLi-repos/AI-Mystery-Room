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

/** DELETE /api/investigations/[id]/evidence/[evidenceId] — owner only. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; evidenceId: string }> },
) {
  const requestId = newRequestId();
  const user = await getSessionUser(request);
  if (!user) return unauthorized();
  const { id, evidenceId } = await params;
  try {
    const db = getPrisma();
    const investigation = await db.investigation.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!investigation) return apiError(404, "NOT_FOUND", "Investigation not found");

    const evidence = await db.evidence.findFirst({
      where: { id: evidenceId, investigationId: id },
      select: { id: true },
    });
    if (!evidence) return apiError(404, "NOT_FOUND", "Evidence not found");

    await db.evidence.delete({ where: { id: evidenceId } });
    return NextResponse.json({ ok: true }, { headers: { ...NO_STORE } });
  } catch (error) {
    logError(requestId, "evidence.delete", error);
    return apiError(500, "INTERNAL", "Failed to delete evidence");
  }
}
