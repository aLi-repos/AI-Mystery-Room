"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { apiErrorMessage, postJson } from "@/lib/client/api";

/**
 * Sign-in page (spec.md §8.2 screen 2 — minimal functional shell; the
 * polished design lands with the P5 UI build-out). Submits to
 * POST /api/auth/login (§7.1) and honours the `next` redirect set by
 * proxy.ts.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { ok, body } = await postJson("/api/auth/login", { email, password });
    if (ok) {
      router.push(next);
      router.refresh();
      return;
    }
    setError(apiErrorMessage(body, "Sign-in failed"));
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm text-muted">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded border border-border bg-white/70 px-3 py-2 text-text"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm text-muted">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded border border-border bg-white/70 px-3 py-2 text-text"
        />
      </div>
      {error ? (
        <p role="alert" className="alert-danger px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-accent px-4 py-2.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="panel w-full max-w-sm animate-rise p-7">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-2.5 py-0.5 text-xs font-medium text-accent">
          Investigator access
        </span>
        <h1 className="mt-4 font-display text-2xl text-text">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Continue to your investigations, evidence and reports.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-sm text-muted">
          No account yet?{" "}
          <Link href="/register" className="font-medium text-accent underline-offset-2 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
