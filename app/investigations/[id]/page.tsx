"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Investigation workspace — evidence upload manager, AI analysis workspace,
 * findings dashboard (facts vs hypotheses, timeline, connections,
 * contradictions, missing evidence), follow-up Q&A and the report panel.
 *
 * Honesty rules carried from the API: files marked "not analysed" are shown
 * as such, and every finding displays the evidence refs behind it.
 */

type Evidence = {
  id: string;
  ref: string;
  category: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  processNote: string | null;
};

type Finding = {
  id: string;
  kind: string;
  statement: string;
  timeLabel: string | null;
  confidence: string;
  evidenceRefs: string[];
};

type QaEntry = { question: string; answer: string; evidenceRefs?: string[] };

type Case = {
  id: string;
  title: string;
  caseDescription: string;
  categories: string[];
  report: string | null;
  reportGeneratedAt: string | null;
  qaHistory: QaEntry[];
  evidence: Evidence[];
  findings: Finding[];
};

type UploadState = {
  name: string;
  status: "uploading" | "done" | "error";
  message?: string;
};

const KIND_LABELS: Record<string, string> = {
  fact: "Fact",
  observation: "Observation",
  hypothesis: "Hypothesis",
  inconsistency: "Inconsistency",
  timeline: "Timeline",
  missing_evidence: "Missing evidence",
  link: "Connection",
  suspect: "Suspect",
  lead: "AI lead",
  simulated_evidence: "Simulated evidence",
  alternative: "Alternative explanation",
};

const SUGGESTED_QUESTIONS = [
  "What happened in this incident?",
  "What are the important findings?",
  "Identify suspicious activities.",
  "Create a timeline of events.",
  "Find contradictions between evidence.",
  "What additional evidence is required?",
];

const MAX_FILE_MB = 4;

const CATEGORY_LABELS: Record<string, string> = {
  cctv: "CCTV footage",
  audio: "Audio recordings",
  photograph: "Photographs",
  fingerprint: "Fingerprints",
  dna: "DNA & forensic",
  phone_records: "Phone & call records",
  location: "Location & movement",
  documents: "Documents & other",
  video: "CCTV / video",
  image: "Photos & images",
  pdf: "PDF documents",
  text: "Text documents",
  other: "Other files",
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? fallback;
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/* --------------------------------------------------------------------- */
/* Sub-panels                                                            */
/* --------------------------------------------------------------------- */

function SectionTitle({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-display text-lg text-text">{children}</h2>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

function EvidenceCard({
  item,
  onDelete,
}: {
  item: Evidence;
  onDelete: (id: string) => void;
}) {
  const analysed = item.status === "analyzed";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-white/75 p-3">
      <span className="evidence-chip" title={`Evidence ID ${item.ref}`}>
        {item.ref}
      </span>
      <span className="min-w-0 truncate text-sm font-medium text-text" title={item.filename}>
        {item.filename}
      </span>
      <span className="text-xs text-muted">
        {item.category} · {fmtSize(item.sizeBytes)}
      </span>
      <span
        className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${
          analysed
            ? "border-[rgba(44,154,91,0.45)] bg-[rgba(44,154,91,0.1)] text-success"
            : "border-[rgba(242,194,0,0.55)] bg-evidence-soft text-[#7a5f00]"
        }`}
      >
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        {analysed ? "analysed" : "stored · not analysed"}
      </span>
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="text-xs text-muted underline-offset-2 transition hover:text-danger hover:underline"
      >
        remove
      </button>
      {item.processNote ? (
        <span className="basis-full text-xs text-[#8a6d00]">{item.processNote}</span>
      ) : null}
    </li>
  );
}

function FindingCard({
  finding,
  evidenceByRef,
  tone,
}: {
  finding: Finding;
  evidenceByRef: Map<string, Evidence>;
  tone: "fact" | "hypothesis" | "plain";
}) {
  const toneStyles =
    tone === "fact"
      ? "border-l-4 border-l-success"
      : tone === "hypothesis"
        ? "border-l-4 border-l-evidence"
        : "border-l-4 border-l-[var(--ai)]";
  return (
    <li className={`rounded-lg border border-border bg-white/75 p-4 ${toneStyles}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-border bg-white/80 px-2 py-0.5 font-medium text-text">
          {KIND_LABELS[finding.kind] ?? finding.kind}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 ${
            finding.confidence === "high"
              ? "bg-[rgba(44,154,91,0.12)] text-success"
              : finding.confidence === "low"
                ? "bg-evidence-soft text-[#7a5f00]"
                : "bg-ai-soft text-ai"
          }`}
        >
          {finding.confidence} confidence
        </span>
        {finding.timeLabel ? (
          <span className="font-mono text-muted">⏱ {finding.timeLabel}</span>
        ) : null}
        {finding.evidenceRefs.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {finding.evidenceRefs.map((ref) => (
              <span
                key={ref}
                className="evidence-chip"
                title={evidenceByRef.get(ref)?.filename ?? "uploaded evidence"}
              >
                {ref}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-muted">from case description only</span>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-text">{finding.statement}</p>
    </li>
  );
}

/* --------------------------------------------------------------------- */
/* Page                                                                  */
/* --------------------------------------------------------------------- */

export default function InvestigationWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Upload state (per-file status list)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMsg, setAnalysisMsg] = useState<string | null>(null);

  // Q&A state
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [qaMsg, setQaMsg] = useState<string | null>(null);

  // Report state
  const [generating, setGenerating] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  // Story analysis → evidence recommendations
  const [recBusy, setRecBusy] = useState(false);
  const [recs, setRecs] = useState<{ type: string; reason: string }[]>([]);
  const [recMsg, setRecMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/investigations/${id}`, { cache: "no-store" });
      if (res.status === 401) {
        router.replace(`/login?next=/investigations/${id}`);
        return;
      }
      if (!res.ok) {
        setLoadError(await readError(res, "Failed to load investigation"));
        return;
      }
      setCaseData(await res.json());
    } catch {
      setLoadError("Failed to load investigation");
    }
  }, [id, router]);

  useEffect(() => {
    // load() awaits the fetch before any setState — no cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setUploadMsg(null);
    setUploads(files.map((f) => ({ name: f.name, status: "uploading" as const })));

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch(`/api/investigations/${id}/evidence`, {
          method: "POST",
          body: form,
        });
        if (res.ok) {
          setUploads((prev) =>
            prev.map((u, idx) => (idx === i ? { ...u, status: "done" } : u)),
          );
        } else {
          const message = await readError(res, "upload failed");
          setUploads((prev) =>
            prev.map((u, idx) =>
              idx === i ? { ...u, status: "error", message } : u,
            ),
          );
        }
      } catch {
        setUploads((prev) =>
          prev.map((u, idx) =>
            idx === i ? { ...u, status: "error", message: "network error" } : u,
          ),
        );
      }
    }
    setUploadMsg(`Processed ${files.length} file(s).`);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await load();
  }

  async function deleteEvidence(evidenceId: string) {
    setUploadMsg(null);
    try {
      const res = await fetch(`/api/investigations/${id}/evidence/${evidenceId}`, {
        method: "DELETE",
      });
      if (!res.ok) setUploadMsg(await readError(res, "Delete failed"));
      await load();
    } catch {
      setUploadMsg("Delete failed");
    }
  }

  async function runAnalysis() {
    setAnalyzing(true);
    setAnalysisMsg(null);
    try {
      const res = await fetch(`/api/investigations/${id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setAnalysisMsg(body?.error?.message ?? "Analysis failed");
      } else {
        setAnalysisMsg(`Analysis complete — ${body.findings?.length ?? 0} findings.`);
      }
    } catch {
      setAnalysisMsg("Analysis failed");
    }
    setAnalyzing(false);
    await load();
  }

  async function runRecommend() {
    setRecBusy(true);
    setRecMsg(null);
    try {
      const res = await fetch(`/api/investigations/${id}/recommend`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setRecMsg(body?.error?.message ?? "Story analysis failed");
        setRecs([]);
      } else {
        const list = Array.isArray(body.recommendations) ? body.recommendations : [];
        setRecs(list);
        if (list.length === 0) setRecMsg(body.summary || "No specific evidence recommended.");
      }
    } catch {
      setRecMsg("Story analysis failed");
    }
    setRecBusy(false);
  }

  async function askQuestion(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setAsking(true);
    setQaMsg(null);
    try {
      const res = await fetch(`/api/investigations/${id}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) setQaMsg(body?.error?.message ?? "Question failed");
      setQuestion("");
    } catch {
      setQaMsg("Question failed");
    }
    setAsking(false);
    await load();
  }

  async function generateReport() {
    setGenerating(true);
    setReportMsg(null);
    try {
      const res = await fetch(`/api/investigations/${id}/report`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) setReportMsg(body?.error?.message ?? "Report failed");
      else setReportMsg("Report generated.");
    } catch {
      setReportMsg("Report failed");
    }
    setGenerating(false);
    await load();
  }

  if (loadError) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <p className="alert-danger p-4 text-sm">{loadError}</p>
        <Link
          href="/investigations"
          className="mt-4 inline-block font-medium text-accent underline-offset-2 hover:underline"
        >
          ← Back to investigations
        </Link>
      </main>
    );
  }

  if (!caseData) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="panel flex items-center gap-5 p-6">
          <span className="fp-scan shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm text-text">Scanning case file…</p>
            <div className="progress-indeterminate relative mt-3 h-1.5 overflow-hidden rounded-full bg-border" />
          </div>
        </div>
      </main>
    );
  }

  const analysedCount = caseData.evidence.filter((e) => e.status === "analyzed").length;
  const unanalysed = caseData.evidence.filter((e) => e.status !== "analyzed");
  const qaHistory = Array.isArray(caseData.qaHistory) ? caseData.qaHistory : [];

  const evidenceByRef = new Map(caseData.evidence.map((e) => [e.ref, e]));
  const byKind = (kind: string) => caseData.findings.filter((f) => f.kind === kind);
  const observations = [
    ...byKind("fact"),
    ...byKind("observation"),
  ];
  const hypotheses = byKind("hypothesis");
  const timeline = byKind("timeline");
  const inconsistencies = byKind("inconsistency");
  const connections = byKind("link");
  const missing = byKind("missing_evidence");
  const suspects = byKind("suspect");
  const leads = byKind("lead");
  const simulated = byKind("simulated_evidence");
  const alternatives = byKind("alternative");

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/investigations" className="font-display text-lg text-text">
          ← Investigations
        </Link>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="hidden sm:inline">
            {analysedCount}/{caseData.evidence.length} evidence analysed
          </span>
          {caseData.report ? (
            <Link
              href={`/investigations/${id}/report`}
              className="rounded border border-border bg-white/70 px-2.5 py-1 font-medium text-accent transition hover:border-accent"
            >
              View report
            </Link>
          ) : null}
        </div>
      </header>

      {/* Case header */}
      <section className="panel mt-6 animate-rise p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-2.5 py-0.5 text-xs font-medium text-accent">
              Case file
            </span>
            <h1 className="mt-2 font-display text-3xl text-text">{caseData.title}</h1>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {caseData.categories.map((c) => (
              <span
                key={c}
                className="rounded-full border border-border bg-white/70 px-2.5 py-0.5 text-xs text-muted"
              >
                {CATEGORY_LABELS[c] ?? c}
              </span>
            ))}
          </div>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-accent">
            Case description
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded border border-border bg-white/70 p-4 font-sans text-sm text-muted">
            {caseData.caseDescription}
          </pre>
        </details>
      </section>

      {/* Evidence upload manager */}
      <section className="panel mt-5 p-6">
        <SectionTitle hint={`${caseData.evidence.length} file(s)`}>
          Evidence
        </SectionTitle>
        <div className="mt-3 rounded-lg border border-dashed border-border-strong bg-white/60 p-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => uploadFiles(e.target.files)}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110"
          />
          <p className="mt-2 text-xs text-muted">
            Max {MAX_FILE_MB} MB per file · 20 files max · only the categories
            selected for this case are accepted.
          </p>
          {unanalysed.length > 0 ? (
            <p className="alert-info mt-3 px-3 py-2 text-xs">
              {unanalysed.length} file(s) ({unanalysed.map((e) => e.ref).join(", ")})
              will be listed as present but <strong>not analysed</strong> — this
              deployment cannot process their contents.
            </p>
          ) : null}
        </div>

        {/* AI story analysis → evidence recommendations */}
        <div className="mt-4 rounded-lg border border-border bg-white/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm text-muted">
              Let the AI read your case story and recommend which evidence to
              collect — and why each type is relevant.
            </p>
            <button
              type="button"
              onClick={runRecommend}
              disabled={recBusy}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {recBusy ? "Analysing story…" : "Analyse story → recommend evidence"}
            </button>
          </div>
          {recMsg ? <p className="mt-2 text-xs text-muted">{recMsg}</p> : null}
          {recs.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {recs.map((r, i) => (
                <li
                  key={i}
                  className="rounded border border-border bg-white/75 p-3 text-sm"
                >
                  <span className="evidence-chip">{r.type}</span>
                  <span className="ml-2 text-text">{r.reason}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Per-file upload status */}
        {uploads.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {uploads.map((u, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded border border-border bg-white/70 px-3 py-1.5 text-xs"
              >
                {u.status === "uploading" ? (
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-ai text-ai status-pulse" />
                ) : u.status === "done" ? (
                  <span className="text-success">✓</span>
                ) : (
                  <span className="text-danger">✕</span>
                )}
                <span className="truncate text-text">{u.name}</span>
                <span className="ml-auto shrink-0 text-muted">
                  {u.status === "uploading"
                    ? "uploading…"
                    : u.status === "done"
                      ? "stored"
                      : u.message}
                </span>
              </li>
            ))}
          </ul>
        ) : uploadMsg ? (
          <p className="mt-3 text-xs text-muted">{uploadMsg}</p>
        ) : null}
        {uploadMsg && uploads.length > 0 ? (
          <p className="mt-2 text-xs text-muted">{uploadMsg}</p>
        ) : null}

        {caseData.evidence.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {caseData.evidence.map((e) => (
              <EvidenceCard key={e.id} item={e} onDelete={deleteEvidence} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">No evidence uploaded yet.</p>
        )}
      </section>

      {/* AI analysis */}
      <section className="panel mt-5 p-6">
        <SectionTitle hint={analyzing ? undefined : `${analysedCount} analysed`}>
          AI analysis
        </SectionTitle>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-muted">
            The AI investigates the case story and every analysable file —
            developing leads, suspects, contradictions and a timeline. Files are
            optional; without uploads it works from your story and generates
            clearly-labelled <strong>SIMULATED</strong> material.
          </p>
          <button
            type="button"
            onClick={runAnalysis}
            disabled={analyzing}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {analyzing ? "Investigating…" : "Run AI investigation"}
          </button>
        </div>

        {analyzing ? (
          <div className="alert-info mt-4 p-4" role="status">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ai text-ai status-pulse" />
              AI investigating {caseData.evidence.length} uploaded file(s) —
              building leads, suspects, timeline and contradictions…
            </div>
            <div className="progress-indeterminate relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/70" />
          </div>
        ) : null}
        {caseData.evidence.length === 0 && !analyzing ? (
          <p className="mt-3 text-sm text-muted">
            No files uploaded yet — analysis runs from your case story and the
            selected evidence categories.
          </p>
        ) : null}
        {analysisMsg && !analyzing ? (
          <p
            className={`mt-3 text-sm ${
              analysisMsg.startsWith("Analysis complete") ? "text-success" : "text-danger"
            }`}
          >
            {analysisMsg}
          </p>
        ) : null}
      </section>

      {/* Findings dashboard */}
      {caseData.findings.length > 0 ? (
        <section className="mt-5">
          <SectionTitle hint={`${caseData.findings.length} findings`}>
            Findings
          </SectionTitle>

          {/* Verified observations & clues */}
          {observations.length > 0 ? (
            <div className="panel mt-3 p-5">
              <h3 className="font-display text-base text-text">
                Verified observations & clues
              </h3>
              <p className="mb-3 text-xs text-muted">
                Grounded in the case description or referenced evidence files.
              </p>
              <ul className="space-y-2.5">
                {observations.map((f) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    evidenceByRef={evidenceByRef}
                    tone="fact"
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {/* Suspect profiles */}
          {suspects.length > 0 ? (
            <div className="panel mt-3 p-5">
              <h3 className="font-display text-base text-text">Suspect profiles</h3>
              <p className="mb-3 text-xs text-muted">
                Persons of interest identified from the case story and evidence —
                role, opportunity, motive and suspicious behaviour.
              </p>
              <ul className="space-y-2.5">
                {suspects.map((f) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    evidenceByRef={evidenceByRef}
                    tone="plain"
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {/* AI-generated SIMULATED evidence — clearly labelled */}
          {simulated.length > 0 ? (
            <div className="panel mt-3 border-l-4 border-l-[var(--evidence)] bg-[rgba(242,194,0,0.06)] p-5">
              <h3 className="font-display text-base text-text">
                Simulated material (AI-generated)
              </h3>
              <p className="mb-3 text-xs text-[#8a6d00]">
                ⚠ These are AI-developed illustrations to guide the
                investigation — they are NOT real evidence and were never
                extracted from any file. Real uploads always appear above with
                their EV reference.
              </p>
              <ul className="space-y-2.5">
                {simulated.map((f) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    evidenceByRef={evidenceByRef}
                    tone="hypothesis"
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {/* Timeline visualization */}
          {timeline.length > 0 ? (
            <div className="panel mt-3 p-5">
              <h3 className="font-display text-base text-text">Timeline</h3>
              <p className="mb-4 text-xs text-muted">
                Ordered events where evidence supports a time.
              </p>
              <ol className="relative ml-3 border-l-2 border-dashed border-border-strong">
                {timeline.map((f) => (
                  <li key={f.id} className="relative mb-5 pl-5 last:mb-0">
                    <span className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white bg-accent shadow" />
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-sm font-semibold text-accent">
                        {f.timeLabel ?? "—"}
                      </span>
                      {f.evidenceRefs.map((ref) => (
                        <span
                          key={ref}
                          className="evidence-chip"
                          title={evidenceByRef.get(ref)?.filename ?? "uploaded evidence"}
                        >
                          {ref}
                        </span>
                      ))}
                    </div>
                    <p className="mt-0.5 text-sm text-text">{f.statement}</p>
                    <span className="text-xs text-muted">{f.confidence} confidence</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {/* Facts vs hypotheses */}
          {hypotheses.length > 0 ? (
            <div className="panel mt-3 p-5">
              <h3 className="font-display text-base text-text">
                Hypotheses <span className="text-xs font-normal text-[#8a6d00]">— unverified inferences</span>
              </h3>
              <p className="mb-3 text-xs text-muted">
                Plausible interpretations that evidence has not confirmed.
              </p>
              <ul className="space-y-2.5">
                {hypotheses.map((f) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    evidenceByRef={evidenceByRef}
                    tone="hypothesis"
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {/* Contradictions */}
          {inconsistencies.length > 0 ? (
            <div className="panel mt-3 border-l-4 border-l-danger p-5">
              <h3 className="font-display text-base text-text">
                Contradictions & inconsistencies
              </h3>
              <ul className="mt-3 space-y-2.5">
                {inconsistencies.map((f) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    evidenceByRef={evidenceByRef}
                    tone="plain"
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {/* Connections */}
          {connections.length > 0 ? (
            <div className="panel mt-3 p-5">
              <h3 className="font-display text-base text-text">
                Evidence connections
              </h3>
              <svg
                className="mt-2 h-4 w-full"
                viewBox="0 0 300 16"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  className="connection-line"
                  d="M4 8 H100 L140 4 H210 L250 8 H296"
                  fill="none"
                  stroke="var(--emerald)"
                  strokeOpacity="0.55"
                  strokeWidth="1.5"
                />
                <circle cx="4" cy="8" r="3" fill="var(--evidence)" />
                <circle cx="296" cy="8" r="3" fill="var(--evidence)" />
              </svg>
              <ul className="mt-2 space-y-2.5">
                {connections.map((f) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    evidenceByRef={evidenceByRef}
                    tone="plain"
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {/* AI-generated investigative leads */}
          {leads.length > 0 ? (
            <div className="panel mt-3 p-5">
              <h3 className="font-display text-base text-text">
                Investigative leads
              </h3>
              <p className="mb-3 text-xs text-muted">
                Next actions the AI investigator recommends — follow-ups to
                pursue, not established facts.
              </p>
              <ul className="space-y-2.5">
                {leads.map((f) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    evidenceByRef={evidenceByRef}
                    tone="plain"
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {/* Alternative explanations */}
          {alternatives.length > 0 ? (
            <div className="panel mt-3 p-5">
              <h3 className="font-display text-base text-text">
                Alternative explanations
              </h3>
              <p className="mb-3 text-xs text-muted">
                Competing readings of the same evidence — considered and
                weighed against the leading hypothesis.
              </p>
              <ul className="space-y-2.5">
                {alternatives.map((f) => (
                  <FindingCard
                    key={f.id}
                    finding={f}
                    evidenceByRef={evidenceByRef}
                    tone="hypothesis"
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {/* Missing evidence alert */}
          {missing.length > 0 ? (
            <div className="panel mt-3 border-l-4 border-l-[var(--evidence)] bg-[rgba(242,194,0,0.06)] p-5">
              <h3 className="font-display text-base text-text">
                Missing evidence & next steps
              </h3>
              <ul className="mt-3 space-y-2">
                {missing.map((f) => (
                  <li
                    key={f.id}
                    className="flex flex-wrap items-baseline gap-2 text-sm text-text"
                  >
                    <span className="text-[#8a6d00]">◆</span>
                    <span>{f.statement}</span>
                    {f.evidenceRefs.map((ref) => (
                      <span key={ref} className="evidence-chip">
                        {ref}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Follow-up Q&A */}
      <section className="panel mt-5 p-6">
        <SectionTitle hint={qaHistory.length ? `${qaHistory.length} asked` : undefined}>
          Ask the investigator AI
        </SectionTitle>
        <div className="mt-3 flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") askQuestion(question);
            }}
            placeholder="e.g. What happened in this incident?"
            aria-label="Follow-up question"
            className="min-w-0 flex-1 rounded-lg border border-border bg-white/80 px-3 py-2.5 text-sm text-text placeholder:text-muted"
          />
          <button
            type="button"
            onClick={() => askQuestion(question)}
            disabled={asking || question.trim().length < 2}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {asking ? "…" : "Ask"}
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => askQuestion(q)}
              disabled={asking}
              className="rounded-full border border-border bg-white/70 px-3 py-1 text-xs text-muted transition hover:border-accent hover:text-text disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        {qaMsg ? <p className="alert-danger mt-3 px-3 py-2 text-sm">{qaMsg}</p> : null}
        {qaHistory.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {qaHistory.map((h, i) => (
              <li key={i} className="rounded-lg border border-border bg-white/75 p-4 text-sm">
                <p className="text-muted">Q: {h.question}</p>
                <p className="mt-1 text-text">
                  A: {h.answer}
                  {Array.isArray(h.evidenceRefs) && h.evidenceRefs.length > 0 ? (
                    <span className="ml-2 inline-flex gap-1 align-middle">
                      {h.evidenceRefs.map((r) => (
                        <span key={r} className="evidence-chip">
                          {r}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Report */}
      <section className="panel mt-5 p-6">
        <SectionTitle>Final verdict & report</SectionTitle>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={generateReport}
            disabled={generating}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {generating
              ? "Generating…"
              : caseData.report
                ? "Regenerate final verdict"
                : "Generate final verdict & report"}
          </button>
          {caseData.report ? (
            <>
              <button
                type="button"
                onClick={() =>
                  downloadText(
                    `${caseData.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-report.md`,
                    caseData.report ?? "",
                  )
                }
                className="rounded-lg border border-border-strong bg-white/70 px-4 py-2.5 text-sm font-semibold text-text transition hover:border-accent"
              >
                ↓ Download (.md)
              </button>
              <Link
                href={`/investigations/${id}/report`}
                className="text-sm font-medium text-accent underline-offset-2 hover:underline"
              >
                Open full report view
              </Link>
            </>
          ) : null}
        </div>
        {reportMsg ? <p className="mt-3 text-sm text-muted">{reportMsg}</p> : null}
        {caseData.report ? (
          <article className="mt-4 rounded-lg border border-border bg-white/75 p-5">
            <p className="mb-3 text-xs text-muted">
              Generated {new Date(caseData.reportGeneratedAt!).toLocaleString()}
            </p>
            <div className="max-h-[32rem] overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-text">
              {caseData.report}
            </div>
          </article>
        ) : (
          <p className="mt-3 text-sm text-muted">
            No report yet — generate one after running the analysis.
          </p>
        )}
      </section>
    </main>
  );
}
