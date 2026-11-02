"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";

function GameUI() {
  const params = useSearchParams();
  const router = useRouter();
  const mysteryId = params.get("mysteryId");
  const difficulty = params.get("difficulty") || "easy";
  const [session, setSession] = useState<any>(null);
  const [stage, setStage] = useState<any>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [hint, setHint] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mysteryId) return;
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mysteryId, difficulty }),
      credentials: "include",
    })
      .then(r => r.json())
      .then(data => {
        setSession(data.session);
        router.replace(`/game/${data.session.id}`);
      })
      .catch(e => setFeedback("Failed to start session. Try logging in."));
  }, [mysteryId, difficulty, router]);

  const sessionId = session?.id || (typeof window !== "undefined" ? window.location.pathname.split("/")[2] : null);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/sessions/${sessionId}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        const s = data.session || data;
        // Find current stage from progress
        const currentNum = s.currentStageNumber || 1;
        const stageRow = s.stageProgress?.find((p: any) => p.stage?.stageNumber === currentNum);
        if (stageRow && stageRow.stage) {
          setStage({ ...stageRow.stage, progress: stageRow });
        }
        setSession(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId]);

  const submitAnswer = () => {
    if (!sessionId || !stage) return;
    fetch(`/api/sessions/${sessionId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: stage.id, answer }),
      credentials: "include",
    })
      .then(r => r.json())
      .then(data => {
        if (data.correct) {
          setFeedback("Correct! Stage solved.");
          setTimeout(() => window.location.reload(), 800);
        } else {
          setFeedback(`Incorrect. Try again or request a hint. (${data.attempts || 1} attempts)`);
        }
      })
      .catch(() => setFeedback("Error submitting answer."));
  };

  const requestHint = () => {
    if (!sessionId || !stage) return;
    fetch(`/api/sessions/${sessionId}/hints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId: stage.id }),
      credentials: "include",
    })
      .then(r => r.json())
      .then(data => {
        setHint(data.hint);
        setFeedback(`Hint (${data.hint.level}): ${data.hint.content}`);
      })
      .catch(() => setFeedback("Could not retrieve hint."));
  };

  if (!sessionId || (loading && !session)) {
    return (
      <main className="min-h-screen px-6 py-12 bg-bg text-text max-w-3xl mx-auto">
        <h1 className="font-display text-3xl">Loading Mystery...</h1>
        <p className="mt-4 text-muted">Starting session. If this takes too long, check your database connection.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12 bg-bg text-text max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-display text-3xl">{stage?.title || "Mystery Room"}</h1>
        <Link href="/" className="text-sm text-muted hover:text-text">Exit</Link>
      </div>
      <div className="border border-border rounded-xl p-6 bg-surface mb-6">
        <h2 className="font-display text-xl mb-3">Stage {stage?.stageNumber || 1}</h2>
        <p className="prose-narrative text-muted leading-relaxed">{stage?.narrative || "Loading stage content..."}</p>
      </div>
      <div className="border border-border rounded-xl p-6 bg-surface mb-6">
        <h3 className="font-bold mb-2">Clues</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted">
          {stage?.clues?.map((c: any) => (
            <li key={c.id || c.clueNumber}>{c.content}</li>
          ))}
        </ul>
      </div>
      <div className="border border-border rounded-xl p-6 bg-surface mb-6">
        <h3 className="font-bold mb-2">Puzzle</h3>
        <p className="mb-3 text-sm text-muted">{stage?.puzzlePrompt || ""}</p>
        {stage?.puzzleType === "multiple_choice" && stage?.puzzleOptions && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {stage.puzzleOptions.map((opt: string, i: number) => (
              <button
                key={i}
                onClick={() => setAnswer(opt)}
                className={`text-sm px-3 py-2 rounded-md border transition text-left ${answer === opt ? "border-accent bg-accent/10 text-text" : "border-border bg-bg text-muted hover:text-text"}`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
        {(stage?.puzzleType === "text_input" || stage?.puzzleType === "cipher" || stage?.puzzleType === "numeric_code") && (
          <input
            type="text"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            className="w-full px-4 py-2 rounded-md bg-bg border border-border text-text mb-4 focus:outline-none focus:border-accent"
            placeholder="Enter your answer..."
          />
        )}
        <div className="flex gap-3">
          <button onClick={submitAnswer} className="px-4 py-2 rounded-md bg-accent text-bg font-bold hover:brightness-110">Submit Answer</button>
          <button onClick={requestHint} className="px-4 py-2 rounded-md border border-border hover:bg-surface text-sm">Request Hint</button>
        </div>
        {feedback && <p className="mt-3 text-sm text-muted">{feedback}</p>}
        {hint && (
          <div className="mt-3 p-3 rounded-md bg-surface border border-border text-sm text-ai">
            <strong>Hint Level {hint.level} ({hint.source || "static"}):</strong> {hint.content}
          </div>
        )}
      </div>
      <div className="text-xs text-muted">Session: {sessionId}</div>
    </main>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg text-text p-12">Loading...</div>}>
      <GameUI />
    </Suspense>
  );
}
