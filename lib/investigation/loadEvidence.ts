import { getPrisma } from "@/lib/prisma";
import {
  MAX_INLINE_ANALYSIS_BYTES,
  planProcessing,
} from "@/lib/investigation/evidence";
import type { EvidenceInput } from "@/lib/ai/investigation";

export type { EvidenceInput };

/**
 * Loads an investigation's evidence as AI inputs (owner-verified by caller).
 * Binary contents are only base64-encoded when the processing plan says the
 * format is actually analysable and fits the inline budget.
 */
export async function loadEvidenceInputs(
  investigationId: string,
): Promise<EvidenceInput[]> {
  const db = getPrisma();
  const rows = await db.evidence.findMany({
    where: { investigationId },
    orderBy: { createdAt: "asc" },
  });

  let inlineBudget = MAX_INLINE_ANALYSIS_BYTES;
  const inputs: EvidenceInput[] = [];

  for (const row of rows) {
    const filename = row.filename;
    const mimeType = row.mimeType;
    const sizeBytes = row.sizeBytes;
    const detected = planProcessing(filename, mimeType, sizeBytes);
    const note = row.processNote ?? detected.note;

    let text: string | null = row.textContent;
    let inline: { mimeType: string; data: string } | null = null;

    if (detected.mode === "inline" && sizeBytes <= inlineBudget) {
      inline = { mimeType, data: Buffer.from(row.data).toString("base64") };
      inlineBudget -= sizeBytes;
    } else if (detected.mode === "inline") {
      // Budget exhausted — honest note instead of silently dropping.
      text = null;
      inline = null;
    } else if (detected.mode === "none") {
      text = null;
      inline = null;
    }

    inputs.push({
      id: row.id,
      ref: row.ref,
      category: row.category,
      filename,
      note: inline === null && text === null ? note : null,
      text,
      inline,
    });
  }
  return inputs;
}

/** Digest of stored findings for report/QA prompts. */
export async function loadFindingsDigest(investigationId: string): Promise<string> {
  const db = getPrisma();
  const findings = await db.finding.findMany({
    where: { investigationId },
    orderBy: { createdAt: "asc" },
  });
  if (findings.length === 0) return "No findings recorded yet.";
  return findings
    .map((f) => {
      const refs = f.evidenceIds.length
        ? ` [${f.evidenceIds.length} evidence ref(s)]`
        : " [case description only]";
      const time = f.timeLabel ? ` (${f.timeLabel})` : "";
      return `- [${f.kind}, ${f.confidence}]${time} ${f.statement}${refs}`;
    })
    .join("\n");
}
