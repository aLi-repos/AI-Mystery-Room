import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import LogoutButton from "@/components/LogoutButton";
import { getSessionUserFromCookie, sessionCookieName } from "@/lib/auth/session";

/**
 * Player dashboard SHELL (spec.md §14 P2 — "dashboard shell"; full screen 3
 * with stats/history lands in P5/P3).
 *
 * - Reads the verified session server-side; `proxy.ts` already guards the
 *   route, this check is defence in depth (§9.1).
 * - The mystery card reads the seeded catalog (D4) but degrades gracefully
 *   when no database is configured (§9.10).
 * - Stats tiles are placeholders until the P3 game core records sessions.
 */

type LibraryState =
  | { state: "ok"; title: string; tagline: string; stageCount: number; estimatedMinutes: number }
  | { state: "unavailable" };

async function loadMysteryCard(): Promise<LibraryState> {
  if (!process.env.DATABASE_URL) return { state: "unavailable" };
  try {
    const { getPrisma } = await import("@/lib/prisma");
    const mystery = await getPrisma().mystery.findFirst({
      where: { status: "published" },
      orderBy: { createdAt: "asc" },
      select: {
        title: true,
        tagline: true,
        stageCount: true,
        estimatedMinutes: true,
      },
    });
    if (!mystery) return { state: "unavailable" };
    return { state: "ok", ...mystery };
  } catch {
    return { state: "unavailable" };
  }
}

const STATS = [
  { label: "Cases solved", value: "—" },
  { label: "Best score", value: "—" },
  { label: "Hints used", value: "—" },
  { label: "In progress", value: "—" },
];

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const user = await getSessionUserFromCookie(
    cookieStore.get(sessionCookieName())?.value,
  );
  if (!user) redirect("/login");

  const library = await loadMysteryCard();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="font-display text-xl text-text">
          MysteryAI
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">
            {user.displayName}
            {user.isGuest ? (
              <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-xs text-muted">
                guest
              </span>
            ) : null}
          </span>
          <LogoutButton />
        </div>
      </header>

      <section className="mt-10">
        <h1 className="font-display text-3xl text-text">
          Welcome back, {user.displayName}
        </h1>
        {user.isGuest ? (
          <p className="mt-2 text-sm text-muted">
            You&apos;re playing as a guest.{" "}
            <Link href="/register" className="text-accent underline-offset-2 hover:underline">
              Create an account
            </Link>{" "}
            to keep your cases after your guest session expires.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">Pick up where you left off.</p>
        )}
      </section>

      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded border border-border bg-surface p-4"
          >
            <p className="text-xs uppercase tracking-wide text-muted">
              {stat.label}
            </p>
            <p className="mt-1 font-display text-2xl text-text">{stat.value}</p>
          </div>
        ))}
      </section>
      <p className="mt-2 text-xs text-muted">
        Stats appear after your first completed case.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-lg text-text">Case file</h2>
        {library.state === "ok" ? (
          <article className="mt-3 rounded border border-border bg-surface p-5">
            <h3 className="font-display text-xl text-text">{library.title}</h3>
            <p className="mt-1 text-sm text-muted">{library.tagline}</p>
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted">
              <div>
                <dt className="inline">Stages: </dt>
                <dd className="inline text-text">{library.stageCount}</dd>
              </div>
              <div>
                <dt className="inline">Est. time: </dt>
                <dd className="inline text-text">{library.estimatedMinutes} min</dd>
              </div>
              <div>
                <dt className="inline">Difficulty: </dt>
                <dd className="inline text-text">Easy · Medium · Hard</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted">
              Case selection opens with the mystery-room screens.
            </p>
          </article>
        ) : (
          <p className="mt-3 rounded border border-border bg-surface p-5 text-sm text-muted">
            The mystery library is unavailable right now
            {process.env.DATABASE_URL ? " (database error)." : " (no database configured)."}
          </p>
        )}
      </section>
    </main>
  );
}
