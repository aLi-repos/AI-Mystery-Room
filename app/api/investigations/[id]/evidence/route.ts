import { NextResponse, type NextRequest } from "next/server";
import {
  NO_STORE,
  apiError,
  logError,
  newRequestId,
  unauthorized,
  validationError,
} from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/prisma";
import {
  checkUpload,
  clampText,
  planProcessing,
} from "@/lib/investigation/evidence";

/**
 * POST /api/investigations/[id]/evidence — multipart file upload.
 *
 * Security: session + ownership, per-file size/type validation, category must
 * have been selected at creation, filenames sanitized, bytes stored
 * server-side only (BYTEA — never exposed to other users).
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
      select: { id: true, categories: true },
    });
    if (!investigation) return apiError(404, "NOT_FOUND", "Investigation not found");

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return validationError({ body: "Expected multipart/form-data" });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return validationError({ file: "Missing file" });
    }

    const currentCount = await db.evidence.count({ where: { investigationId: id } });
    const check = checkUpload({
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      selected: investigation.categories,
      currentFileCount: currentCount,
    });
    if (!check.ok) {
      return apiError(400, check.code, check.message);
    }

    const plan = planProcessing(file.name, file.type || "application/octet-stream", file.size);
    const bytes = Buffer.from(await file.arrayBuffer());

    // Extract UTF-8 text for text files so analysis can read contents.
    let contentText: string | null = null;
    if (plan.mode === "text") {
      contentText = clampText(bytes.toString("utf8"));
    }

    const existingRefs = await db.evidence.findMany({
      where: { investigationId: id },
      select: { ref: true },
    });
    const nextNumber = existingRefs.length + 1;

    const created = await db.evidence.create({
      data: {
        investigationId: id,
        ref: `EV${nextNumber}`,
        category: plan.category,
        // Strip any path components from the client-supplied name.
        filename: file.name.replace(/[/\\]/g, "_").slice(0, 255),
        mimeType: (file.type || "application/octet-stream").slice(0, 100),
        sizeBytes: file.size,
        data: bytes,
        textContent: contentText,
        status: plan.mode === "none" ? "unprocessed" : "stored",
        processNote: plan.note,
      },
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
    });

    return NextResponse.json({ evidence: created }, { status: 201, headers: { ...NO_STORE } });
  } catch (error) {
    logError(requestId, "evidence.upload", error);
    return apiError(500, "INTERNAL", "Failed to store evidence");
  }
}
