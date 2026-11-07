"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function PlayPage() {
  const [mysteries, setMysteries] = useState<
    { id: string; title?: string; tagline?: string; stageCount?: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mysteries", { credentials: "include" })
      .then(r => r.json())
      .then(data => setMysteries(data.items || []))
      .catch(() => setMysteries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen px-6 py-12 bg-bg text-text max-w-4xl mx-auto">
      <h1 className="font-display text-4xl">Select a Mystery</h1>
      <p className="mt-2 text-muted">One predefined case. Three difficulty profiles.</p>
      <div className="mt-8 grid gap-6">
        {loading ? (
          <div className="text-muted">Loading...</div>
        ) : mysteries.length === 0 ? (
          <div className="text-muted">No mysteries published. (DB seed required)</div>
        ) : (
          mysteries.map((m) => (
            <div key={m.id} className="border border-border rounded-xl p-6 bg-surface hover:border-accent transition">
              <h2 className="font-display text-2xl">{m.title}</h2>
              <p className="text-muted mt-1">{m.tagline}</p>
              <div className="mt-4 flex gap-3">
                {["easy", "medium", "hard"].map((d: string) => (
                  <Link
                    key={d}
                    href={`/game?mysteryId=${m.id}&difficulty=${d}`}
                    className="px-4 py-2 rounded-md bg-bg border border-border hover:border-accent text-sm capitalize font-semibold"
                  >
                    {d}
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-8">
        <Link href="/" className="text-muted hover:text-text">← Back</Link>
      </div>
    </main>
  );
}
