"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiErrorMessage, postJson } from "@/lib/client/api";

/**
 * Create Investigation — case title, incident description, evidence
 * categories. Categories gate which uploads the server accepts; the hints
 * state honestly what will and will not be analysed.
 */

const CATEGORY_OPTIONS: { value: string; label: string; hint: string; icon: string }[] = [
  {
    value: "video",
    label: "CCTV / video",
    hint: "stored — frames are NOT analysed",
    icon: "M4 6h12v12H4zM16 10l4-2v8l-4-2",
  },
  {
    value: "image",
    label: "Photos & images",
    hint: "analysed by AI",
    icon: "M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4",
  },
  {
    value: "pdf",
    label: "PDF documents",
    hint: "analysed by AI",
    icon: "M6 3h9l4 4v14H6zM14 3v5h5",
  },
  {
    value: "text",
    label: "Text & case scripts",
    hint: "analysed by AI",
    icon: "M6 6h12M6 10h12M6 14h8M6 18h6",
  },
  {
    value: "audio",
    label: "Audio recordings",
    hint: "analysed by AI",
    icon: "M12 4v10M9 8v2a3 3 0 0 0 6 0V8M8 19h8",
  },
  {
    value: "other",
    label: "Other files",
    hint: "stored — NOT analysed",
    icon: "M4 7h16v10H4zM8 7V5h8v2",
  },
];

export default function NewInvestigationPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [caseDescription, setCaseDescription] = useState("");
  const [categories, setCategories] = useState<string[]>(["text", "image", "pdf"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCategory(value: string) {
    setCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (categories.length === 0) {
      setError("Select at least one evidence category.");
      return;
    }
    setBusy(true);
    const { ok, body } = await postJson("/api/investigations", {
      title,
      caseDescription,
      categories,
    });
    setBusy(false);
    if (ok && body && "id" in body && typeof body.id === "string") {
      router.push(`/investigations/${body.id}`);
    } else {
      setError(apiErrorMessage(body, "Failed to create investigation"));
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/investigations" className="font-display text-xl text-text">
          ← Investigations
        </Link>
        <span className="text-xs text-muted">New case file</span>
      </header>

      <div className="mt-8 animate-rise">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-2.5 py-0.5 text-xs font-medium text-accent">
          Step 1 — describe the case
        </span>
        <h1 className="mt-3 font-display text-3xl text-text">New investigation</h1>
        <p className="mt-1 text-sm text-muted">
          The AI analyses only what you provide here and in the next step — it
          never invents evidence.
        </p>
      </div>

      <form onSubmit={submit} className="mt-7 space-y-6">
        <div className="panel p-6">
          <label htmlFor="title" className="block text-sm font-medium text-text">
            Case title
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            maxLength={120}
            placeholder="e.g. Warehouse 12 break-in"
            className="mt-1.5 w-full rounded border border-border bg-white/80 px-3 py-2.5 text-text placeholder:text-muted"
          />
        </div>

        <div className="panel p-6">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="case" className="block text-sm font-medium text-text">
              Case description / incident script
            </label>
            <span className="text-xs text-muted">{caseDescription.length} / 50000</span>
          </div>
          <textarea
            id="case"
            value={caseDescription}
            onChange={(e) => setCaseDescription(e.target.value)}
            required
            minLength={10}
            maxLength={50000}
            rows={10}
            placeholder="Paste the incident report, timeline notes, witness summaries or investigation brief…"
            className="mt-1.5 w-full rounded border border-border bg-white/80 px-3 py-2.5 text-text placeholder:text-muted"
          />
          <p className="mt-1.5 text-xs text-muted">
            Findings cite this description separately from uploaded evidence.
          </p>
        </div>

        <fieldset className="panel p-6">
          <legend className="px-1 text-sm font-medium text-text">
            Evidence types to investigate
          </legend>
          <p className="mb-3 text-xs text-muted">
            Select every type you plan to upload — files outside these
            categories are rejected at upload.
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {CATEGORY_OPTIONS.map((opt) => {
              const active = categories.includes(opt.value);
              const analysed = !opt.hint.startsWith("stored");
              return (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition ${
                    active
                      ? "border-accent bg-accent-soft"
                      : "border-border bg-white/70 hover:border-border-strong"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleCategory(opt.value)}
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium text-text">
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={analysed ? "text-accent" : "text-muted"}
                        aria-hidden="true"
                      >
                        <path d={opt.icon} />
                      </svg>
                      {opt.label}
                    </span>
                    <span
                      className={`mt-0.5 block text-xs ${
                        analysed ? "text-success" : "text-muted"
                      }`}
                    >
                      {analysed ? "✓ " : "○ "}
                      {opt.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {error ? (
          <p role="alert" className="alert-danger px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? "Creating case…" : "Create & upload evidence"}
          </button>
          <Link href="/investigations" className="text-sm text-muted hover:text-text">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
