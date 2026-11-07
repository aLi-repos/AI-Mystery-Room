"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * Final report view — full-screen reading surface for the generated
 * investigation report with download (.md) and print actions.
 */

type ReportCase = {
  id: string;
  title: string;
  report: string | null;
  reportGeneratedAt: string | null;
  evidence: { ref: string; filename: string; status: string; category: string }[];
  findings: { id: string }[];
};

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [data, setData] = useState<ReportCase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/investigations/${id}`, { cache: "no-store" });
      if (res.status === 401) {
        router.replace(`/login?next=/investigations/${id}/report`);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Failed to load report");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Failed to load report");
    }
  }, [id, router]);

  useEffect(() => {
    // Async fetch resolves before setState — no effect cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/investigations/${id}/report`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) setMsg(body?.error?.message ?? "Report failed");
    } catch {
      setMsg("Report failed");
    }
    setGenerating(false);
    await load();
  }

  function download() {
    if (!data?.report) return;
    const blob = new Blob([data.report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-report.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <p className="alert-danger p-4 text-sm">{error}</p>
        <Link
          href={`/investigations/${id}`}
          className="mt-4 inline-block font-medium text-accent underline-offset-2 hover:underline"
        >
          ← Back to case
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="panel relative h-24 overflow-hidden p-4">
          <div className="progress-indeterminate absolute inset-x-4 top-7 h-1.5 overflow-hidden rounded-full bg-border" />
          <p className="mt-10 text-sm text-muted">Loading report…</p>
        </div>
      </main>
    );
  }

  const analysed = data.evidence.filter((e) => e.status === "analyzed");
  const unprocessed = data.evidence.filter((e) => e.status !== "analyzed");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/investigations/${id}`}
          className="font-display text-lg text-text"
        >
          ← {data.title}
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {generating ? "Generating…" : data.report ? "Regenerate" : "Generate report"}
          </button>
          {data.report ? (
            <>
              <button
                type="button"
                onClick={download}
                className="rounded-lg border border-border-strong bg-white/70 px-4 py-2 text-sm font-semibold text-text transition hover:border-accent"
              >
                ↓ Download
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg border border-border-strong bg-white/70 px-4 py-2 text-sm font-semibold text-text transition hover:border-accent"
              >
                Print
              </button>
            </>
          ) : null}
        </div>
      </header>

      <div className="panel mt-6 animate-rise p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-4">
          <div>
            <span className="text-xs uppercase tracking-widest text-accent">
              Investigation report
            </span>
            <h1 className="font-display text-2xl text-text sm:text-3xl">{data.title}</h1>
          </div>
          {data.reportGeneratedAt ? (
            <span className="text-xs text-muted">
              {new Date(data.reportGeneratedAt).toLocaleString()}
            </span>
          ) : null}
        </div>

        {/* Evidence coverage strip — always visible, honest about limits */}
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full border border-[rgba(44,154,91,0.45)] bg-[rgba(44,154,91,0.1)] px-2.5 py-1 text-success">
            {analysed.length} evidence analysed
          </span>
          <span className="rounded-full border border-[rgba(242,194,0,0.55)] bg-evidence-soft px-2.5 py-1 text-[#7a5f00]">
            {unprocessed.length} stored but not analysed
          </span>
          <span className="rounded-full border border-border bg-white/70 px-2.5 py-1 text-muted">
            {data.findings.length} findings
          </span>
        </div>
        {unprocessed.length > 0 ? (
          <p className="alert-info mt-3 px-3 py-2 text-xs">
            {unprocessed.map((e) => `${e.ref} (${e.filename})`).join(", ")} — present
            in the case file but <strong>not analysed</strong>; the report must not
            claim their contents.
          </p>
        ) : null}
        {msg ? <p className="alert-danger mt-3 px-3 py-2 text-sm">{msg}</p> : null}

        {data.report ? (
          <article className="mt-5 whitespace-pre-wrap font-sans text-sm leading-relaxed text-text">
            {data.report}
          </article>
        ) : (
          <div className="mt-6 text-center">
            <p className="text-sm text-muted">
              No report has been generated for this case yet.
            </p>
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="mt-4 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {generating ? "Generating…" : "Generate report"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
