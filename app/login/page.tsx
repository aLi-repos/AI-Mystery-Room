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
  const next = searchParams.get("next") ?? "/dashboard";

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
          className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
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
          className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-accent px-4 py-2 font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded border border-border bg-surface p-6">
        <h1 className="font-display text-2xl text-text">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Welcome back to the mystery room.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-sm text-muted">
          No account yet?{" "}
          <Link href="/register" className="text-accent underline-offset-2 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
