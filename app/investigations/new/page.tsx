"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiErrorMessage, postJson } from "@/lib/client/api";

/**
 * Create Investigation — title, case description, evidence category selection.
 * Categories gate which uploads are accepted (server-validated too).
 */

const CATEGORY_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "video", label: "CCTV / video", hint: "stored; frames not analysed" },
  { value: "image", label: "Photos / images", hint: "analysed" },
  { value: "pdf", label: "PDF documents", hint: "analysed" },
  { value: "text", label: "Text files / scripts", hint: "analysed" },
  { value: "audio", label: "Audio recordings", hint: "analysed" },
  { value: "other", label: "Other files", hint: "stored; not analysed" },
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
      </header>

      <h1 className="mt-8 font-display text-3xl text-text">New investigation</h1>

      <form onSubmit={submit} className="mt-6 space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm text-muted">
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
            className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-text placeholder:text-muted"
          />
        </div>

        <div>
          <label htmlFor="case" className="block text-sm text-muted">
            Case description / incident script
          </label>
          <textarea
            id="case"
            value={caseDescription}
            onChange={(e) => setCaseDescription(e.target.value)}
            required
            minLength={10}
            maxLength={50000}
            rows={10}
            placeholder="Paste the incident report, timeline notes, or investigation brief…"
            className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-text placeholder:text-muted"
          />
          <p className="mt-1 text-xs text-muted">{caseDescription.length} / 50000</p>
        </div>

        <fieldset>
          <legend className="text-sm text-muted">Evidence categories to analyse</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {CATEGORY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-2 rounded border p-3 text-sm ${
                  categories.includes(opt.value)
                    ? "border-accent bg-surface"
                    : "border-border bg-surface"
                }`}
              >
                <input
                  type="checkbox"
                  checked={categories.includes(opt.value)}
                  onChange={() => toggleCategory(opt.value)}
                  className="mt-0.5"
                />
                <span>
                  <span className="text-text">{opt.label}</span>
                  <span className="block text-xs text-muted">{opt.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error ? (
          <p className="rounded border border-border bg-surface px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="rounded bg-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create investigation"}
        </button>
      </form>
    </main>
  );
}
