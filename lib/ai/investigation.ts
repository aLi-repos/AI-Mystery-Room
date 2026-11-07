/**
 * AI investigation capabilities (Gemini via the existing provider adapter
 * pattern from lib/ai/adapter.ts — plain fetch, responseSchema JSON mode).
 *
 * Grounding rules enforced in the prompt AND validated on the way back:
 *  - every finding carries `evidenceRefs` (e.g. "EV1"); the server drops any
 *    ref that is not a real uploaded evidence file (anti-fabrication),
 *  - video / unsupported files appear in the prompt with their explicit
 *    "NOT analysed" note so the model can never claim their contents,
 *  - when AI is unavailable these functions return null — callers must show
 *    an error, never invent findings.
 */

export type EvidenceInput = {
  id: string; // DB uuid
  ref: string; // "EV1"
  category: string;
  filename: string;
  /** Honest processing note when contents were NOT analysed (video, other). */
  note: string | null;
  /** UTF-8 text for text files (null for binary formats). */
  text: string | null;
  /** Base64 for image/pdf/audio (null when not analysed). */
  inline: { mimeType: string; data: string } | null;
};

export type AnalysisFinding = {
  kind:
    | "fact"
    | "observation"
    | "hypothesis"
    | "inconsistency"
    | "timeline"
    | "missing_evidence"
    | "link";
  statement: string;
  timeLabel: string | null;
  evidenceRefs: string[];
  confidence: "high" | "medium" | "low";
};

export type AnalysisResult = {
  summary: string;
  findings: AnalysisFinding[];
  missingEvidence: string[];
};

export type QaResult = { answer: string; evidenceRefs: string[] };

function geminiAvailable(): string | null {
  const key = process.env.AI_API_KEY;
  if (!key || process.env.AI_PROVIDER !== "gemini") return null;
  return key;
}

async function callGemini(
  parts: Record<string, unknown>[],
  schema: Record<string, unknown>,
  maxOutputTokens = 4096,
): Promise<Record<string, unknown> | null> {
  const key = geminiAvailable();
  if (!key) return null;
  try {
    const base =
      process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
    const model = process.env.AI_MODEL || "gemini-3.6-flash";
    const res = await fetch(`${base}/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          maxOutputTokens,
        },
        // Grounded, conservative behaviour.
        safetySettings: [],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") return null;
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return parsed;
  } catch {
    return null;
  }
}

function evidenceManifest(evidence: EvidenceInput[]): string {
  if (evidence.length === 0) return "EVIDENCE FILES: none uploaded yet.";
  const lines = evidence.map((e) => {
    const analysed =
      e.note === null
        ? e.text !== null
          ? "contents included below"
          : "binary contents attached to this message"
        : `NOT ANALYSED — ${e.note}`;
    return `- ${e.ref} [${e.category}] ${e.filename}: ${analysed}`;
  });
  return `EVIDENCE FILES:\n${lines.join("\n")}`;
}

/**
 * Inlines the actual text contents of text evidence. Without this the model
 * only sees filenames in the manifest and must honestly report the contents
 * as "not provided".
 */
function textEvidenceBlocks(evidence: EvidenceInput[]): string {
  const blocks = evidence
    .filter((e) => e.text !== null && e.note === null)
    .map((e) => `--- ${e.ref} (${e.filename}) CONTENTS ---\n${e.text}`);
  return blocks.length ? `\n\nEVIDENCE CONTENTS (text files):\n${blocks.join("\n\n")}` : "";
}

function groundingRules(): string {
  return [
    "RULES (must obey):",
    "1. Use ONLY the case description and the evidence listed. Never invent evidence, CCTV events, timestamps, people or file contents.",
    "2. Every finding MUST cite supporting evidence via evidenceRefs (e.g. [\"EV1\"]). Use an empty array ONLY for findings derived solely from the case description, and say so in the statement.",
    "3. evidenceRefs may only contain refs that appear in the EVIDENCE FILES list. If a file is marked NOT ANALYSED, you may mention that it exists and is unprocessed, but you must NOT claim any content from it.",
    "4. Separate OBSERVED FACTS from HYPOTHESES: use kind=fact/observation for what evidence shows, kind=hypothesis for inference (label uncertainty in the statement).",
    "5. Use kind=inconsistency for contradictions between evidence items, kind=timeline for ordered events (fill timeLabel when evidence supports a time), kind=missing_evidence for gaps, kind=link for related evidence.",
    "6. Express uncertainty honestly (confidence=medium/low) when evidence is ambiguous or incomplete. Never fabricate to fill gaps — use missing_evidence instead.",
  ].join("\n");
}

const FINDING_KINDS = [
  "fact",
  "observation",
  "hypothesis",
  "inconsistency",
  "timeline",
  "missing_evidence",
  "link",
];

const analysisSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: FINDING_KINDS },
          statement: { type: "string" },
          timeLabel: { type: "string" },
          evidenceRefs: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["kind", "statement", "evidenceRefs", "confidence"],
      },
    },
    missingEvidence: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "findings", "missingEvidence"],
};

function textPart(text: string): Record<string, unknown> {
  return { text };
}

function inlinePart(inline: { mimeType: string; data: string }): Record<string, unknown> {
  return { inlineData: { mimeType: inline.mimeType, data: inline.data } };
}

/** Full case analysis → structured findings (null = AI unavailable/failed). */
export async function analyzeCase(args: {
  caseDescription: string;
  evidence: EvidenceInput[];
  requirements?: string[];
}): Promise<AnalysisResult | null> {
  const { caseDescription, evidence, requirements } = args;
  const prompt = [
    "You are a forensic investigation assistant. Analyse the case below.",
    "",
    `CASE DESCRIPTION:\n${caseDescription}`,
    "",
    evidenceManifest(evidence),
    textEvidenceBlocks(evidence),
    "",
    requirements?.length
      ? `INVESTIGATOR REQUIREMENTS:\n${requirements.map((r) => `- ${r}`).join("\n")}`
      : "",
    "",
    groundingRules(),
    "",
    "Return JSON matching the schema: summary (2-4 sentences), findings (the important observations, inconsistencies, links, timeline entries and hypotheses), missingEvidence (evidence that should be collected next).",
  ]
    .filter(Boolean)
    .join("\n");

  const parts: Record<string, unknown>[] = [textPart(prompt)];
  for (const e of evidence) {
    if (e.inline) parts.push(inlinePart(e.inline));
  }

  const data = await callGemini(parts, analysisSchema);
  if (!data) return null;

  const summary = typeof data.summary === "string" ? data.summary : "";
  const missingEvidence = Array.isArray(data.missingEvidence)
    ? data.missingEvidence.filter((m): m is string => typeof m === "string")
    : [];
  const rawFindings = Array.isArray(data.findings) ? data.findings : [];
  const findings: AnalysisFinding[] = [];
  for (const item of rawFindings) {
    if (typeof item !== "object" || item === null) continue;
    const f = item as Record<string, unknown>;
    const kind = FINDING_KINDS.includes(f.kind as string)
      ? (f.kind as AnalysisFinding["kind"])
      : "observation";
    const statement = typeof f.statement === "string" ? f.statement.trim() : "";
    if (!statement) continue;
    findings.push({
      kind,
      statement,
      timeLabel: typeof f.timeLabel === "string" && f.timeLabel.trim() ? f.timeLabel.trim() : null,
      evidenceRefs: Array.isArray(f.evidenceRefs)
        ? f.evidenceRefs.filter((r): r is string => typeof r === "string")
        : [],
      confidence: ["high", "medium", "low"].includes(f.confidence as string)
        ? (f.confidence as "high" | "medium" | "low")
        : "medium",
    });
  }
  return { summary, findings, missingEvidence };
}

/** Follow-up question answering, grounded in the same evidence. */
export async function answerQuestion(args: {
  caseDescription: string;
  evidence: EvidenceInput[];
  findingsDigest: string;
  question: string;
  history: { question: string; answer: string }[];
}): Promise<QaResult | null> {
  const { caseDescription, evidence, findingsDigest, question, history } = args;
  const historyBlock = history.length
    ? `PREVIOUS EXCHANGE:\n${history
        .slice(-4)
        .map((h) => `Q: ${h.question}\nA: ${h.answer}`)
        .join("\n")}`
    : "";
  const prompt = [
    "You are a forensic investigation assistant answering an investigator's question about a case.",
    `CASE DESCRIPTION:\n${caseDescription}`,
    "",
    evidenceManifest(evidence),
    textEvidenceBlocks(evidence),
    "",
    `CURRENT FINDINGS:\n${findingsDigest}`,
    "",
    historyBlock,
    "",
    `QUESTION: ${question}`,
    "",
    groundingRules(),
    "",
    "Answer the question directly and concisely. Cite evidenceRefs for any claim grounded in a file; use [] when the answer comes only from the case description or findings. If the answer is not supported by available evidence, say what is missing instead of guessing.",
  ]
    .filter(Boolean)
    .join("\n");

  const parts: Record<string, unknown>[] = [textPart(prompt)];
  for (const e of evidence) {
    if (e.inline) parts.push(inlinePart(e.inline));
  }

  const schema = {
    type: "object",
    properties: {
      answer: { type: "string" },
      evidenceRefs: { type: "array", items: { type: "string" } },
    },
    required: ["answer", "evidenceRefs"],
  };
  const data = await callGemini(parts, schema, 2048);
  if (!data || typeof data.answer !== "string") return null;
  const evidenceRefs = Array.isArray(data.evidenceRefs)
    ? data.evidenceRefs.filter((r): r is string => typeof r === "string")
    : [];
  return { answer: data.answer, evidenceRefs };
}

/** Structured investigation report (markdown) from stored analysis state. */
export async function generateReport(args: {
  caseDescription: string;
  evidence: EvidenceInput[];
  findingsDigest: string;
  missingEvidence: string[];
  qaHistory: { question: string; answer: string }[];
}): Promise<string | null> {
  const { caseDescription, evidence, findingsDigest, missingEvidence, qaHistory } = args;
  const prompt = [
    "You are a forensic investigation assistant. Write a professional investigation report in Markdown with these sections:",
    "# Investigation Report",
    "## 1. Case Summary",
    "## 2. Evidence Examined (list each file with its EV ref and whether it was analysed)",
    "## 3. Key Findings (each with [EVn] citations)",
    "## 4. Timeline (only if evidence supports it; otherwise state that a timeline cannot be established)",
    "## 5. Inconsistencies and Contradictions",
    "## 6. Missing Evidence and Recommended Next Steps",
    "## 7. Uncertainties and Limitations",
    "",
    `CASE DESCRIPTION:\n${caseDescription}`,
    "",
    evidenceManifest(evidence),
    textEvidenceBlocks(evidence),
    "",
    `FINDINGS:\n${findingsDigest}`,
    "",
    `KNOWN MISSING EVIDENCE:\n${missingEvidence.map((m) => `- ${m}`).join("\n") || "- none recorded"}`,
    "",
    qaHistory.length
      ? `INVESTIGATOR Q&A:\n${qaHistory
          .slice(-6)
          .map((h) => `Q: ${h.question}\nA: ${h.answer}`)
          .join("\n")}`
      : "",
    "",
    groundingRules(),
    "",
    "Cite [EVn] refs for every evidence-grounded claim. State plainly when something was not analysed or cannot be concluded.",
  ]
    .filter(Boolean)
    .join("\n");

  const base =
    process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
  const key = geminiAvailable();
  if (!key) return null;
  try {
    const res = await fetch(
      `${base}/models/${process.env.AI_MODEL || "gemini-3.6-flash"}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [textPart(prompt)] }],
          generationConfig: { maxOutputTokens: 4096 },
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" && text.trim() ? text : null;
  } catch {
    return null;
  }
}
