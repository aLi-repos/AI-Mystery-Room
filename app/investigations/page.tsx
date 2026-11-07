"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

/**
 * Investigation history — the user's past and current cases with evidence /
 * finding counts and report status. Client-side fetch (httpOnly session
 * cookie; proxy.ts guards the route).
 */

type Item = {
  id: string;
  title: string;
  categories: string[];
  createdAt: string;
  hasReport: boolean;
  evidenceCount: number;
  findingsCount: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  video: "CCTV/video",
  image: "photos",
  pdf: "PDF",
  text: "text",
  audio: "audio",
  other: "other",
};

export default function InvestigationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/investigations", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/login?next=/investigations");
          return;
        }
        const body = await res.json();
        if (!cancelled) {
          if (res.ok) setItems(body.items ?? []);
          else setError(body?.error?.message ?? "Failed to load investigations");
        }
      } catch {
        if (!cancelled) setError("Failed to load investigations");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/dashboard" className="font-display text-xl text-text">
          MysteryAI
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-muted transition hover:text-text"
          >
            Dashboard
          </Link>
          <LogoutButton />
        </div>
      </header>

      <section className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-2.5 py-0.5 text-xs font-medium text-accent">
            Case archive
          </span>
          <h1 className="mt-3 font-display text-3xl text-text">
            Investigation history
          </h1>
          <p className="mt-1 text-sm text-muted">
            Every case you have opened, with evidence, findings and reports.
          </p>
        </div>
        <Link
          href="/investigations/new"
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"
        >
          + New investigation
        </Link>
      </section>

      <section className="mt-8">
        {error ? (
          <p className="alert-danger p-4 text-sm">{error}</p>
        ) : items === null ? (
          <div className="panel flex items-center gap-5 p-6">
            <span className="fp-scan shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm text-text">Opening case archive…</p>
              <div className="progress-indeterminate relative mt-3 h-1.5 overflow-hidden rounded-full bg-border" />
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="panel p-8 text-center">
            <p className="font-display text-lg text-text">No cases yet</p>
            <p className="mt-1 text-sm text-muted">
              Your investigation archive is empty — open your first case.
            </p>
            <Link
              href="/investigations/new"
              className="mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Create your first case
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4">
            {items.map((item, i) => (
              <li key={item.id} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
                <Link
                  href={`/investigations/${item.id}`}
                  className="panel block p-5 transition hover:border-accent"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-lg text-text">{item.title}</h2>
                    <span className="text-xs text-muted">
                      opened {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.categories.map((c) => (
                      <span
                        key={c}
                        className="rounded-full border border-border bg-white/70 px-2 py-0.5 text-xs text-muted"
                      >
                        {CATEGORY_LABELS[c] ?? c}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
                    <span>
                      <strong className="text-text">{item.evidenceCount}</strong> evidence
                    </span>
                    <span>
                      <strong className="text-text">{item.findingsCount}</strong> findings
                    </span>
                    {item.hasReport ? (
                      <span className="rounded-full border border-[rgba(44,154,91,0.45)] bg-[rgba(44,154,91,0.1)] px-2 py-0.5 font-medium text-success">
                        report ready
                      </span>
                    ) : (
                      <span className="rounded-full border border-border bg-white/70 px-2 py-0.5">
                        no report
                      </span>
                    )}
                    <span className="ml-auto font-medium text-accent">
                      Open case →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
