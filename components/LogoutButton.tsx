"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Logout control for the dashboard shell (spec.md §7.1 — POST /api/auth/logout
 * → 204 + cookie cleared). Pending state is always visible (§8.3).
 */
export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok && response.status !== 204) {
        throw new Error("Logout failed");
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not log out — try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error ? (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={handleLogout}
        disabled={pending}
        className="rounded border border-border bg-surface px-3 py-1.5 text-sm text-text transition-colors hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
