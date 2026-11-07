"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function ResultsPage() {
  const params = useParams();
  const id = params?.id as string;
  const [result, setResult] = useState<{
    status?: string;
    totalScore?: number;
    difficulty?: string;
    mystery?: { title?: string };
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/sessions/${id}/result`, { credentials: "include" })
      .then(r => r.json())
      .then(data => setResult(data.result || null))
      .catch(() => setResult(null));
  }, [id]);

  return (
    <main className="min-h-screen px-6 py-12 bg-bg text-text max-w-3xl mx-auto">
      <h1 className="font-display text-4xl">Results</h1>
      {result ? (
        <div className="mt-8 space-y-6">
          <div className="p-6 rounded-xl bg-surface border border-border">
            <h2 className="text-2xl font-display">{result.mystery?.title || "Mystery Completed"}</h2>
            <p className="text-muted mt-1">Status: <span className="text-accent font-bold capitalize">{result.status}</span></p>
            <p className="mt-2">Score: <span className="font-bold text-2xl">{result.totalScore || 0}</span></p>
            <p className="text-sm text-muted">Difficulty: {result.difficulty}</p>
          </div>
          <Link href="/" className="inline-block px-4 py-2 rounded-md bg-accent text-bg font-bold">Play Again</Link>
        </div>
      ) : (
        <p className="text-muted mt-6">Loading results...</p>
      )}
    </main>
  );
}
