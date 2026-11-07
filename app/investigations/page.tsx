"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

/**
 * Investigation Dashboard — list of the user's investigations + create entry.
 * Client-side fetch (session cookie is httpOnly; proxy guards the route).
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
          <Link href="/dashboard" className="text-sm text-muted hover:text-text">
            Dashboard
          </Link>
          <LogoutButton />
        </div>
      </header>

      <section className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-text">Investigations</h1>
          <p className="mt-1 text-sm text-muted">
            Create a case, upload evidence, and get AI-grounded findings.
          </p>
        </div>
        <Link
          href="/investigations/new"
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + New investigation
        </Link>
      </section>

      <section className="mt-8">
        {error ? (
          <p className="rounded border border-border bg-surface p-4 text-sm text-muted">{error}</p>
        ) : items === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded border border-border bg-surface p-6 text-sm text-muted">
            No investigations yet.{" "}
            <Link href="/investigations/new" className="text-accent underline-offset-2 hover:underline">
              Create your first case
            </Link>
            .
          </div>
        ) : (
          <ul className="grid gap-3">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/investigations/${item.id}`}
                  className="block rounded border border-border bg-surface p-5 hover:border-accent"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-display text-lg text-text">{item.title}</h2>
                    <span className="text-xs text-muted">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {item.categories.map((c) => (
                      <span key={c} className="rounded border border-border px-1.5 py-0.5 text-muted">
                        {c}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    {item.evidenceCount} evidence · {item.findingsCount} findings ·{" "}
                    {item.hasReport ? "report ready" : "no report"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
