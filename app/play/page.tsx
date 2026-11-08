"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

/** Case picker — one button per mystery, no difficulty selection. */
export default function PlayPage() {
  const [mysteries, setMysteries] = useState<
    { id: string; title?: string; tagline?: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mysteries", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setMysteries(data.items || []))
      .catch(() => setMysteries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-4xl text-text">Select a Case</h1>
      <p className="mt-2 text-muted">One predefined case file.</p>
      <div className="mt-8 grid gap-6">
        {loading ? (
          <div className="panel p-5 text-muted">Loading…</div>
        ) : mysteries.length === 0 ? (
          <div className="panel p-5 text-muted">
            No cases published yet.
          </div>
        ) : (
          mysteries.map((m) => (
            <div
              key={m.id}
              className="panel p-6 transition hover:border-accent"
            >
              <h2 className="font-display text-2xl text-text">{m.title}</h2>
              <p className="mt-1 text-muted">{m.tagline}</p>
              <Link
                href={`/game?mysteryId=${m.id}`}
                className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Open case →
              </Link>
            </div>
          ))
        )}
      </div>
      <div className="mt-8">
        <Link href="/dashboard" className="text-muted hover:text-text">
          ← Dashboard
        </Link>
      </div>
    </main>
  );
}
