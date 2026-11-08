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
    | "link"
    | "suspect"
    | "lead"
    | "simulated_evidence"
    | "alternative";
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
    const url = `${base}/models/${model}:generateContent?key=${key}`;
    const init: RequestInit = {
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
    };
    let res = await fetch(url, init);
    // Backoff retries absorb transient rate limits (429) and provider
    // blips — honour Retry-After when present, never fabricate a result.
    for (let attempt = 0; !res.ok && attempt < 2; attempt++) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const delayMs =
        retryAfter > 0 ? Math.min(retryAfter * 1000, 10_000) : 4000 * (attempt + 1);
      await new Promise((r) => setTimeout(r, delayMs));
      res = await fetch(url, init);
    }
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
    "7. EVIDENCE PROVENANCE (critical): findings grounded in UPLOADED files are USER-PROVIDED evidence; findings derived only from your reading of the case story are AI-DEVELOPED. Anything you generate yourself (a witness statement, CCTV scenario, audio transcript, fingerprint/DNA result) MUST be kind=simulated_evidence and its statement MUST begin with \"SIMULATED — \" so it is never mistaken for real evidence. Never claim CCTV frames, fingerprints, DNA or forensic results were extracted from a file unless that file is marked as analysed contents.",
    "8. Use kind=suspect for persons of interest (profile: role, opportunity, motive, suspicious behaviour, evidence refs), kind=lead for actionable investigative leads, and kind=alternative for alternative explanations of the main conclusion.",
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
  "suspect",
  "lead",
  "simulated_evidence",
  "alternative",
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
  categories?: string[];
}): Promise<AnalysisResult | null> {
  const { caseDescription, evidence, requirements, categories } = args;
  const prompt = [
    "You are a forensic investigator. Understand the case story below, identify the persons, events, locations and clues it describes, then DEVELOP THE INVESTIGATION: leads, suspects, contradictions, timeline, connections, missing information and alternative explanations.",
    "",
    `CASE DESCRIPTION:\n${caseDescription}`,
    "",
    categories?.length
      ? `SELECTED EVIDENCE CATEGORIES (focus of this investigation):\n${categories.map((c) => `- ${c}`).join("\n")}`
      : "",
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
    "Return JSON matching the schema: summary (2-4 sentences); findings covering: verified observations from the story/uploaded files, SIMULATED evidence descriptions where none exists (labelled, never as genuine), suspect profiles, suspicious behaviour, contradictions, timeline entries, evidence connections, actionable leads, alternative explanations, and unverified hypotheses; missingEvidence (evidence that should be collected next — state the evidence type and why it is relevant to this case).",
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
    "You are a forensic investigator writing the FINAL VERDICT report. Write in Markdown with exactly these sections:",
    "# Investigation Report — Final Verdict",
    "## 1. Case Summary",
    "## 2. Evidence Examined (each file with its EV ref, and whether it was actually analysed; separate user-uploaded files from AI-generated SIMULATED material)",
    "## 3. Timeline Reconstruction (only if supported; otherwise state it cannot be established)",
    "## 4. Suspect Analysis (persons of interest: role, opportunity, motive, suspicious behaviour, supporting evidence IDs)",
    "## 5. Mistakes and Contradictions Discovered",
    "## 6. Evidence Supporting Each Conclusion (every conclusion cites its [EVn] IDs or the case-description source)",
    "## 7. Alternative Explanations",
    "## 8. Most Likely Explanation",
    "## 9. Final Verdict and Confidence Level (verdict must cite the evidence IDs it rests on; state confidence honestly — never claim certainty the evidence cannot support)",
    "## 10. Remaining Uncertainties",
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
    "Cite [EVn] refs for every evidence-grounded claim. Mark AI-generated material as SIMULATED and keep it separate from real evidence. State plainly when something was not analysed or cannot be concluded; the verdict must explain its reasoning and name the evidence IDs behind it.",
  ]
    .filter(Boolean)
    .join("\n");

  const base =
    process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
  const key = geminiAvailable();
  if (!key) return null;
  try {
    const url = `${base}/models/${process.env.AI_MODEL || "gemini-3.6-flash"}:generateContent?key=${key}`;
    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [textPart(prompt)] }],
        generationConfig: { maxOutputTokens: 4096 },
      }),
    };
    let res = await fetch(url, init);
    // One retry with backoff — same transient-limit absorption as callGemini.
    for (let attempt = 0; !res.ok && attempt < 2; attempt++) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const delayMs =
        retryAfter > 0 ? Math.min(retryAfter * 1000, 10_000) : 4000 * (attempt + 1);
      await new Promise((r) => setTimeout(r, delayMs));
      res = await fetch(url, init);
    }
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" && text.trim() ? text : null;
  } catch {
    return null;
  }
}

export type EvidenceRecommendation = { type: string; reason: string };
export type RecommendationResult = {
  summary: string;
  recommendations: EvidenceRecommendation[];
};

/**
 * Story analysis → recommended evidence (type + relevance). Runs on the
 * case description alone, before any upload: it RECOMMENDS evidence and
 * never claims any exists or was analysed.
 */
export async function recommendEvidence(
  caseDescription: string,
  categories: string[] = [],
): Promise<RecommendationResult | null> {
  const prompt = [
    "You are a forensic investigator analysing a case story BEFORE any evidence has been collected.",
    `CASE STORY:\n${caseDescription}`,
    "",
    categories.length
      ? `SELECTED EVIDENCE CATEGORIES (focus of this investigation):\n${categories.map((c) => `- ${c}`).join("\n")}`
      : "",
    "",
    "Identify the persons, events, locations and clues the story describes, then recommend the evidence that should be collected to investigate the case. Cover the supported types where relevant: CCTV/video footage, audio recordings, photographs/images, fingerprints, DNA/forensic samples, phone/call records, location/movement records, PDF/text documents and other supporting files.",
    "For each recommendation give the evidence type and a short reason explaining why it is relevant to THIS case.",
    "Never state that evidence exists or was analysed — only recommend what should be collected. If the story is too vague, say what detail is missing.",
    "Return JSON: {summary: string (2-3 sentences on what the story describes), recommendations: [{type: string, reason: string}]}.",
  ].join("\n");
  const schema = {
    type: "object",
    properties: {
      summary: { type: "string" },
      recommendations: {
        type: "array",
        items: {
          type: "object",
          properties: { type: { type: "string" }, reason: { type: "string" } },
          required: ["type", "reason"],
        },
      },
    },
    required: ["summary", "recommendations"],
  };
  const data = await callGemini([textPart(prompt)], schema, 2048);
  if (!data) return null;
  const summary = typeof data.summary === "string" ? data.summary : "";
  const raw = Array.isArray(data.recommendations) ? data.recommendations : [];
  const recommendations: EvidenceRecommendation[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const type = typeof r.type === "string" ? r.type.trim() : "";
    const reason = typeof r.reason === "string" ? r.reason.trim() : "";
    if (type && reason) recommendations.push({ type, reason });
  }
  return { summary, recommendations };
}
