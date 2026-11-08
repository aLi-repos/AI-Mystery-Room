/**
 * Evidence validation + processing classification (AI investigation MVP).
 *
 * PURE module (no I/O) — every rule here is unit-tested.
 *
 * Honesty contract: a file is only `processable` when this deployment can
 * actually send its contents to the AI. Video has NO frame-extraction
 * capability in serverless (no ffmpeg), so video is stored but classified
 * `unprocessed` with an explicit note — the analysis prompt receives that
 * note and must never claim video content was observed.
 */

export const EVIDENCE_CATEGORIES = [
  "video",
  "image",
  "pdf",
  "text",
  "audio",
  "other",
] as const;
export type EvidenceCategory = (typeof EVIDENCE_CATEGORIES)[number];

/**
 * Step-B focus categories (what the user selects when creating a case).
 * They map onto the technical kinds above — this deployment has NO
 * fingerprint/DNA extraction capability, so those map to `other`
 * (stored, explicitly NOT analysed).
 */
export const FOCUS_CATEGORIES = [
  "cctv",
  "audio",
  "photograph",
  "fingerprint",
  "dna",
  "phone_records",
  "location",
  "documents",
] as const;
export type FocusCategory = (typeof FOCUS_CATEGORIES)[number];

const FOCUS_TECHNICAL: Record<FocusCategory, EvidenceCategory[]> = {
  cctv: ["video"],
  audio: ["audio"],
  photograph: ["image"],
  fingerprint: ["other"], // no fingerprint extraction capability
  dna: ["other"], // no DNA analysis capability
  phone_records: ["text", "pdf", "other"],
  location: ["text", "pdf", "other"],
  documents: ["text", "pdf", "other"],
};

/**
 * Accepts BOTH technical kinds (legacy cases + tests) and focus categories;
 * expands to the set of technical kinds allowed for upload.
 */
export function expandSelectedCategories(selected: string[]): EvidenceCategory[] {
  const out = new Set<EvidenceCategory>();
  for (const value of selected) {
    if ((EVIDENCE_CATEGORIES as readonly string[]).includes(value)) {
      out.add(value as EvidenceCategory);
    } else if ((FOCUS_CATEGORIES as readonly string[]).includes(value)) {
      for (const kind of FOCUS_TECHNICAL[value as FocusCategory]) out.add(kind);
    }
  }
  return [...out];
}

/** Vercel serverless request-body limit is 4.5 MB — stay safely below. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
/** Per-investigation file cap (keeps analysis payloads bounded). */
export const MAX_FILES_PER_INVESTIGATION = 20;
/** Raw bytes of inline (image/pdf/audio) content sent per analysis run. */
export const MAX_INLINE_ANALYSIS_BYTES = 8 * 1024 * 1024;
/** Text content cap per file (chars) — long files are truncated, not hidden. */
export const MAX_TEXT_CHARS = 50_000;

type ExtensionRule = {
  extensions: string[];
  mimes: string[];
};

/** Allowlist: only formats this deployment can actually process (or store). */
const CATEGORY_RULES: Record<EvidenceCategory, ExtensionRule> = {
  video: {
    extensions: [".mp4", ".webm", ".mov"],
    mimes: ["video/mp4", "video/webm", "video/quicktime"],
  },
  image: {
    extensions: [".png", ".jpg", ".jpeg", ".webp"],
    mimes: ["image/png", "image/jpeg", "image/webp"],
  },
  pdf: { extensions: [".pdf"], mimes: ["application/pdf"] },
  text: {
    extensions: [".txt", ".md", ".csv", ".log", ".json"],
    mimes: [
      "text/plain",
      "text/markdown",
      "text/csv",
      "text/log",
      "application/json",
      "application/xml",
      "text/xml",
    ],
  },
  audio: {
    extensions: [".mp3", ".wav", ".aiff", ".flac", ".ogg"],
    mimes: ["audio/mpeg", "audio/wav", "audio/aiff", "audio/flac", "audio/ogg"],
  },
  // "other" accepts any extension — stored, never analysed.
  other: { extensions: [], mimes: [] },
};

/** How (and whether) the file contents reach the AI. */
export type ProcessMode =
  | "text" // UTF-8 text inlined into the prompt
  | "inline" // base64 inlineData part (image / pdf / audio)
  | "none"; // stored only — contents are NOT analysed

export type ProcessingPlan = {
  category: EvidenceCategory;
  mode: ProcessMode;
  /** Honest, user-facing note; required when mode === "none". */
  note: string | null;
};

function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

export function isEvidentCategory(value: unknown): value is EvidenceCategory {
  return typeof value === "string" && (EVIDENCE_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Infers the category from filename + MIME type.
 * Returns `null` when the combination matches no processable format
 * (callers may still store it explicitly as `other`).
 */
export function inferCategory(filename: string, mimeType: string): EvidenceCategory | null {
  const ext = extOf(filename);
  const mime = mimeType.split(";")[0]!.trim().toLowerCase();
  for (const category of EVIDENCE_CATEGORIES) {
    if (category === "other") continue;
    const rule = CATEGORY_RULES[category];
    if (rule.extensions.includes(ext) || rule.mimes.includes(mime)) return category;
  }
  return null;
}

/**
 * Decides how a file will be analysed. Video and unknown formats are
 * `none` with an explicit note — they are stored but never analysed.
 */
export function planProcessing(
  filename: string,
  mimeType: string,
  sizeBytes: number,
): ProcessingPlan {
  const category = inferCategory(filename, mimeType) ?? "other";

  if (category === "video") {
    return {
      category,
      mode: "none",
      note:
        "Video file stored, but frame extraction is not available in this deployment — the video was NOT analysed.",
    };
  }
  if (category === "other") {
    return {
      category,
      mode: "none",
      note: "File format is not supported for AI analysis — the file was stored but NOT analysed.",
    };
  }
  if (category === "text") {
    return { category, mode: "text", note: null };
  }
  if (category === "pdf" && sizeBytes > MAX_INLINE_ANALYSIS_BYTES) {
    return {
      category,
      mode: "none",
      note: "PDF is too large for inline analysis — stored but NOT analysed.",
    };
  }
  // image / pdf / audio → base64 inlineData
  return { category, mode: "inline", note: null };
}

export type UploadCheck =
  | { ok: true }
  | { ok: false; code: string; message: string };

/**
 * Validates an upload against size, format and the investigation's selected
 * categories. `selected` is the category list chosen at creation time.
 */
export function checkUpload(args: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Focus categories (cctv, fingerprint, …) and/or technical kinds. */
  selected: string[];
  currentFileCount: number;
}): UploadCheck {
  const { filename, mimeType, sizeBytes, selected, currentFileCount } = args;

  if (!filename || filename.length > 255) {
    return { ok: false, code: "FILENAME_INVALID", message: "File name is missing or too long." };
  }
  if (sizeBytes <= 0) {
    return { ok: false, code: "FILE_EMPTY", message: "File is empty." };
  }
  if (sizeBytes > MAX_FILE_BYTES) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `File exceeds the ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB limit.`,
    };
  }
  if (currentFileCount >= MAX_FILES_PER_INVESTIGATION) {
    return {
      ok: false,
      code: "FILE_LIMIT",
      message: `This investigation already has ${MAX_FILES_PER_INVESTIGATION} files.`,
    };
  }

  const plan = planProcessing(filename, mimeType, sizeBytes);
  // A known format outside the selected categories is rejected; unknown
  // formats land in "other" which the user must have selected. `selected`
  // may contain focus categories (cctv, fingerprint, …) — expanded first.
  const known = inferCategory(filename, mimeType);
  const effective = known ?? "other";
  const allowed = new Set(expandSelectedCategories(selected));
  if (!allowed.has(effective)) {
    return {
      ok: false,
      code: "CATEGORY_NOT_SELECTED",
      message: `This file is ${effective} evidence, but that category was not selected for this investigation.`,
    };
  }
  // `plan.category` always equals `effective`; kept for clarity.
  void plan;
  return { ok: true };
}

/** Truncates extracted text, marking the cut so analysis knows it is partial. */
export function clampText(text: string): string {
  if (text.length <= MAX_TEXT_CHARS) return text;
  return `${text.slice(0, MAX_TEXT_CHARS)}\n\n[TRUNCATED: file continues beyond ${MAX_TEXT_CHARS} characters]`;
}
