"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

/**
 * Case starter — POSTs a game session for the selected mystery, then hands
 * off to /game/[sessionId]. This route previously did not exist: /play
 * linked to /game?mysteryId=… which 404'd.
 */
function GameStart() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mysteryId = searchParams.get("mysteryId");
  const [error, setError] = useState<string | null>(null);
  const showError = error ?? (mysteryId ? null : "No case selected.");

  useEffect(() => {
    if (!mysteryId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mysteryId, difficulty: "easy" }),
          credentials: "include",
        });
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && body?.session?.id) {
          router.replace(`/game/${body.session.id}`);
        } else if (res.status === 401) {
          router.replace(
            `/login?next=${encodeURIComponent(`/game?mysteryId=${mysteryId}`)}`,
          );
        } else {
          setError(body?.error?.message ?? "Failed to start the case.");
        }
      } catch {
        if (!cancelled) setError("Failed to start the case.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mysteryId, router]);

  if (showError) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <p className="alert-danger p-4 text-sm">{showError}</p>
        <Link
          href="/play"
          className="mt-4 inline-block font-medium text-accent underline-offset-2 hover:underline"
        >
          ← Back to cases
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <div className="panel flex items-center gap-5 p-6">
        <span className="fp-scan shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm text-text">Opening case…</p>
          <div className="progress-indeterminate relative mt-3 h-1.5 overflow-hidden rounded-full bg-border" />
        </div>
      </div>
    </main>
  );
}

export default function GameStartPage() {
  return (
    <Suspense fallback={null}>
      <GameStart />
    </Suspense>
  );
}
