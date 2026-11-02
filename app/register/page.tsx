"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiErrorMessage, postJson } from "@/lib/client/api";

/**
 * Registration page (spec.md §8.2 screen 2 — minimal functional shell;
 * polished design lands with P5). Submits to POST /api/auth/register (§7.1).
 */
export default function RegisterPage() {
  const router = useRouter();

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
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setError(apiErrorMessage(body, "Registration failed"));
    setPending(false);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded border border-border bg-surface p-6">
        <h1 className="font-display text-2xl text-text">Create account</h1>
        <p className="mt-1 text-sm text-muted">
          Join the mystery room — or play as a guest from the API.
        </p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
              className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
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
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded border border-border bg-surface px-3 py-2 text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            />
            <p className="mt-1 text-xs text-muted">
              At least 8 characters, mixing letters with digits or symbols.
            </p>
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
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-sm text-muted">
          Already registered?{" "}
          <Link href="/login" className="text-accent underline-offset-2 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
