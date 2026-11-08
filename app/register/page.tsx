"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { apiErrorMessage, postJson } from "@/lib/client/api";

/**
 * Registration page — POST /api/auth/register (§7.1). Honours the `next`
 * redirect (mirrors the login page) so "Start an investigation" from the
 * landing page lands directly in the new-investigation workspace.
 */
function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { ok, body } = await postJson("/api/auth/register", {
      displayName,
      email,
      password,
    });
    if (ok) {
      router.push(next);
      router.refresh();
      return;
    }
    setError(apiErrorMessage(body, "Registration failed"));
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7 space-y-4">
      <div>
        <label htmlFor="displayName" className="block text-sm text-muted">
          Display name
        </label>
        <input
          id="displayName"
          type="text"
          required
          maxLength={40}
          autoComplete="nickname"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="mt-1 w-full rounded border border-border bg-white/70 px-3 py-2 text-text"
        />
      </div>
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
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded border border-border bg-white/70 px-3 py-2 text-text"
        />
        <p className="mt-1 text-xs text-muted">
          At least 8 characters, mixing letters with digits or symbols.
        </p>
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
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="panel w-full max-w-sm animate-rise p-7">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-2.5 py-0.5 text-xs font-medium text-accent">
          Step 1 of 2
        </span>
        <h1 className="mt-4 font-display text-2xl text-text">Create account</h1>
        <p className="mt-1 text-sm text-muted">
          Open investigations, upload evidence and run AI analysis.
        </p>
        <Suspense>
          <RegisterForm />
        </Suspense>
        <p className="mt-6 text-sm text-muted">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-accent underline-offset-2 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
