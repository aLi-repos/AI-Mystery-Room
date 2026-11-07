"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Investigation workspace — evidence upload manager, AI analysis workspace,
 * findings with evidence references, follow-up Q&A, and the report viewer.
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

const KIND_LABELS: Record<string, string> = {
  fact: "Fact",
  observation: "Observation",
  hypothesis: "Hypothesis",
  inconsistency: "Inconsistency",
  timeline: "Timeline",
  missing_evidence: "Missing evidence",
  link: "Link",
};

const SUGGESTED_QUESTIONS = [
  "What happened in this incident?",
  "What are the important findings?",
  "Identify suspicious activities.",
  "Create a timeline of events.",
  "Find contradictions between evidence.",
  "What additional evidence is required?",
];

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? fallback;
}

export default function InvestigationWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMsg, setAnalysisMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  // Q&A state
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [qaMsg, setQaMsg] = useState<string | null>(null);

  // Report state
  const [generating, setGenerating] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

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

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadMsg(null);
    let lastError: string | null = null;
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch(`/api/investigations/${id}/evidence`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) lastError = `${file.name}: ${await readError(res, "upload failed")}`;
      } catch {
        lastError = `${file.name}: network error`;
      }
    }
    setUploading(false);
    setUploadMsg(lastError ?? `Uploaded ${files.length} file(s).`);
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
        setSummary(body.summary ?? null);
        setAnalysisMsg(`Analysis complete — ${body.findings?.length ?? 0} findings.`);
      }
    } catch {
      setAnalysisMsg("Analysis failed");
    }
    setAnalyzing(false);
    await load();
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
        <p className="rounded border border-border bg-surface p-4 text-sm text-muted">{loadError}</p>
        <Link href="/investigations" className="mt-4 inline-block text-accent underline-offset-2 hover:underline">
          ← Back to investigations
        </Link>
      </main>
    );
  }

  if (!caseData) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  const analysedCount = caseData.evidence.filter((e) => e.status === "analyzed").length;
  const unanalysed = caseData.evidence.filter((e) => e.status !== "analyzed");
  const qaHistory = Array.isArray(caseData.qaHistory) ? caseData.qaHistory : [];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/investigations" className="font-display text-xl text-text">
          ← Investigations
        </Link>
        <span className="text-sm text-muted">
          {analysedCount}/{caseData.evidence.length} evidence analysed
        </span>
      </header>

      <h1 className="mt-8 font-display text-3xl text-text">{caseData.title}</h1>
      <div className="mt-2 flex flex-wrap gap-2">
        {caseData.categories.map((c) => (
          <span key={c} className="rounded border border-border px-1.5 py-0.5 text-xs text-muted">
            {c}
          </span>
        ))}
      </div>

      {/* Case description */}
      <section className="mt-8">
        <h2 className="font-display text-lg text-text">Case description</h2>
        <pre className="mt-2 whitespace-pre-wrap rounded border border-border bg-surface p-4 font-sans text-sm text-muted">
          {caseData.caseDescription}
        </pre>
      </section>

      {/* Evidence upload manager */}
      <section className="mt-8">
        <h2 className="font-display text-lg text-text">Evidence</h2>
        <div className="mt-2 rounded border border-border bg-surface p-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => uploadFiles(e.target.files)}
            className="block w-full text-sm text-muted file:mr-3 file:rounded file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:text-white"
          />
          <p className="mt-2 text-xs text-muted">
            Max {fmtSize(4 * 1024 * 1024)} per file · 20 files max · formats limited to the
            selected categories. Video and &quot;other&quot; files are stored but not analysed.
          </p>
          {uploading ? <p className="mt-2 text-xs text-muted">Uploading…</p> : null}
          {uploadMsg ? <p className="mt-2 text-xs text-muted">{uploadMsg}</p> : null}
        </div>

        {caseData.evidence.length > 0 ? (
          <ul className="mt-3 divide-y divide-border rounded border border-border bg-surface">
            {caseData.evidence.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="font-mono text-xs text-accent">{e.ref}</span>
                <span className="text-text">{e.filename}</span>
                <span className="text-xs text-muted">
                  {e.category} · {fmtSize(e.sizeBytes)}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    e.status === "analyzed"
                      ? "border border-border text-muted"
                      : "border border-amber-600 text-amber-500"
                  }`}
                >
                  {e.status === "analyzed" ? "analysed" : "not analysed"}
                </span>
                {e.processNote ? (
                  <span className="basis-full text-xs text-amber-500">{e.processNote}</span>
                ) : null}
                <button
                  onClick={() => deleteEvidence(e.id)}
                  className="ml-auto text-xs text-muted underline-offset-2 hover:text-red-400 hover:underline"
                >
                  delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No evidence uploaded yet.</p>
        )}
        {unanalysed.length > 0 ? (
          <p className="mt-2 text-xs text-amber-500">
            {unanalysed.length} file(s) will be listed as present but unprocessed in the analysis.
          </p>
        ) : null}
      </section>

      {/* AI analysis workspace */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg text-text">AI analysis</h2>
          <button
            onClick={runAnalysis}
            disabled={analyzing || caseData.evidence.length === 0}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {analyzing ? "Analysing…" : "Run analysis"}
          </button>
        </div>
        {caseData.evidence.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Upload evidence to enable analysis.</p>
        ) : null}
        {analysisMsg ? <p className="mt-2 text-sm text-muted">{analysisMsg}</p> : null}
        {summary ? (
          <p className="mt-3 rounded border border-border bg-surface p-4 text-sm text-text">
            {summary}
          </p>
        ) : null}
      </section>

      {/* Findings + evidence references */}
      {caseData.findings.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-lg text-text">
            Findings ({caseData.findings.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {caseData.findings.map((f) => (
              <li key={f.id} className="rounded border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded border border-border px-1.5 py-0.5 text-muted">
                    {KIND_LABELS[f.kind] ?? f.kind}
                  </span>
                  <span className="text-muted">confidence: {f.confidence}</span>
                  {f.timeLabel ? <span className="text-muted">⏱ {f.timeLabel}</span> : null}
                  {f.evidenceRefs.length > 0 ? (
                    <span className="font-mono text-accent">{f.evidenceRefs.join(", ")}</span>
                  ) : (
                    <span className="text-muted">case description only</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-text">{f.statement}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Follow-up Q&A */}
      <section className="mt-8">
        <h2 className="font-display text-lg text-text">Ask the investigator AI</h2>
        <div className="mt-2 flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") askQuestion(question);
            }}
            placeholder="e.g. What happened in this incident?"
            className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted"
          />
          <button
            onClick={() => askQuestion(question)}
            disabled={asking || question.trim().length < 2}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {asking ? "…" : "Ask"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => askQuestion(q)}
              disabled={asking}
              className="rounded border border-border px-2 py-1 text-xs text-muted hover:text-text disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        {qaMsg ? <p className="mt-2 text-sm text-red-400">{qaMsg}</p> : null}
        {qaHistory.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {qaHistory.map((h, i) => (
              <li key={i} className="rounded border border-border bg-surface p-4 text-sm">
                <p className="text-muted">Q: {h.question}</p>
                <p className="mt-1 text-text">
                  A: {h.answer}
                  {Array.isArray(h.evidenceRefs) && h.evidenceRefs.length > 0 ? (
                    <span className="ml-2 font-mono text-xs text-accent">
                      [{h.evidenceRefs.join(", ")}]
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Investigation report */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg text-text">Investigation report</h2>
          <button
            onClick={generateReport}
            disabled={generating}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {generating ? "Generating…" : caseData.report ? "Regenerate report" : "Generate report"}
          </button>
        </div>
        {reportMsg ? <p className="mt-2 text-sm text-muted">{reportMsg}</p> : null}
        {caseData.report ? (
          <article className="mt-3 rounded border border-border bg-surface p-5">
            <p className="mb-3 text-xs text-muted">
              Generated {new Date(caseData.reportGeneratedAt!).toLocaleString()}
            </p>
            <div className="whitespace-pre-wrap font-sans text-sm text-text">{caseData.report}</div>
          </article>
        ) : (
          <p className="mt-2 text-sm text-muted">No report yet.</p>
        )}
      </section>
    </main>
  );
}
