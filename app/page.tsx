import Link from "next/link";

/**
 * Landing page — positions MysteryAI as an AI investigation assistant
 * (the mystery game remains available from the dashboard).
 */

const FEATURES = [
  {
    title: "Evidence intake",
    body: "Upload case scripts, photos, PDFs, audio and documents with validated formats, sizes and per-file status.",
    icon: "M4 7h16M4 12h16M4 17h10",
  },
  {
    title: "Grounded AI analysis",
    body: "Every finding cites the evidence behind it — facts, hypotheses, contradictions and gaps are kept apart.",
    icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l4.5 4.5",
  },
  {
    title: "Timeline & connections",
    body: "Events are ordered when evidence supports it, and related evidence is linked into explicit connections.",
    icon: "M12 3v18M6 8l6-5 6 5M6 16l6 5 6-5",
  },
  {
    title: "Structured report",
    body: "Generate and download a Markdown investigation report with evidence references and stated limitations.",
    icon: "M6 3h9l4 4v14H6zM14 3v5h5",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl flex-1 px-6 pt-16 pb-12 md:pt-24">
        <div className="animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-accent">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent status-pulse" />
            AI investigation assistant
          </span>
          <h1 className="mt-6 font-display text-5xl leading-tight tracking-tight text-text md:text-7xl">
            Investigate the case.
            <br />
            <span className="text-accent">Follow the evidence.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted">
            MysteryAI turns raw case material into structured findings — clues,
            observations, timelines, contradictions and gaps — each one
            referencing the evidence it came from. Then ask follow-up questions
            and export a formal report.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link
              href="/register?next=/investigations/new"
              className="rounded-lg bg-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-[0.98]"
            >
              Start an investigation
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-border-strong bg-surface px-6 py-3 font-semibold text-text transition hover:border-accent"
            >
              Sign in
            </Link>
          </div>

          <dl className="mt-12 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["6", "evidence types"],
              ["100%", "refs traced to files"],
              ["0", "invented findings"],
              ["1", "downloadable report"],
            ].map(([value, label]) => (
              <div key={label} className="panel px-4 py-3">
                <dt className="text-xs uppercase tracking-wide text-muted">
                  {label}
                </dt>
                <dd className="font-display text-2xl text-text">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-20">
        <h2 className="font-display text-2xl text-text">From evidence to report</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((feature, i) => (
            <article
              key={feature.title}
              className="panel animate-rise p-6"
              style={{ animationDelay: `${80 + i * 70}ms` }}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={feature.icon} />
                </svg>
              </span>
              <h3 className="mt-4 font-display text-lg text-text">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted">{feature.body}</p>
            </article>
          ))}
        </div>

        <div className="panel mt-10 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h3 className="font-display text-lg text-text">Ready to open a case?</h3>
            <p className="mt-1 text-sm text-muted">
              Create an account, describe the incident and upload your evidence.
            </p>
          </div>
          <Link
            href="/register"
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-white transition hover:brightness-110"
          >
            Create account
          </Link>
        </div>
      </section>
    </main>
  );
}
