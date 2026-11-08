import Link from "next/link";

/**
 * Landing — reference-matched hero composition: central fingerprint-scan
 * branding flanked by deliberate evidence vignettes (left: subject photo,
 * CCTV preview, DNA, EV-01, Bayes formula; right: CCTV camera, footprint,
 * EV-02, AI flowchart, magnified fingerprint, coordinates). Pure SVG/CSS —
 * no external assets. CTA navigates to the working registration flow.
 */

function CardHead({ label, chip }: { label: string; chip?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
        {label}
      </span>
      {chip ? <span className="evidence-chip">{chip}</span> : null}
    </div>
  );
}

export default function Home() {
  return (
    <main data-landing className="relative z-10 flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center px-5 py-10 lg:py-14">
        <div className="grid w-full items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)] lg:items-center lg:gap-8">
          {/* ---------------------------------------------------------- LEFT */}
          <div className="order-2 flex flex-wrap justify-center gap-3 lg:order-1 lg:flex-col">
            {/* Suspicious-person evidence photo */}
            <article className="panel w-[calc(50%-6px)] overflow-hidden p-3 lg:w-full">
              <CardHead label="Subject · photo" chip="EV-01" />
              <div className="relative overflow-hidden rounded-md">
                <svg viewBox="0 0 200 110" className="block w-full" aria-hidden="true">
                  <rect x="1" y="1" width="198" height="108" rx="6" fill="#0e2233" />
                  <g stroke="#39FF14" strokeOpacity="0.75" strokeWidth="2" fill="none">
                    <path d="M8 24V10h16M176 10h16v14M192 86v14h-16M24 100H8V86" />
                  </g>
                  <g fill="#20405a">
                    <circle cx="100" cy="46" r="18" />
                    <path d="M66 106c4-22 17-32 34-32s30 10 34 32z" />
                  </g>
                  <g stroke="#00C853" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="4 6">
                    <path d="M8 40h184M8 68h184" />
                  </g>
                  <rect x="120" y="14" width="66" height="14" rx="3" fill="#39FF14" fillOpacity="0.85" />
                  <text x="126" y="24" fontFamily="monospace" fontSize="9" fill="#06231a">
                    SUBJ-04
                  </text>
                </svg>
                <span className="scan-line" aria-hidden="true" />
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-muted">
                cross-referenced · confidence 0.82
              </p>
            </article>

            {/* CCTV preview with timestamp */}
            <article className="panel w-[calc(50%-6px)] overflow-hidden p-3 lg:w-full">
              <CardHead label="CCTV · cam-03" />
              <div className="relative overflow-hidden rounded-md">
                <svg viewBox="0 0 200 110" className="block w-full" aria-hidden="true">
                  <rect x="1" y="1" width="198" height="108" rx="6" fill="#0b1a26" />
                  <path d="M14 92h172" stroke="#1d3b4f" strokeWidth="2" />
                  <rect x="30" y="34" width="52" height="58" fill="#152c3d" stroke="#274b63" />
                  <path d="M56 34v58" stroke="#274b63" />
                  <g fill="#20405a">
                    <circle cx="140" cy="58" r="8" />
                    <path d="M128 92c2-12 6-18 12-18s10 6 12 18z" />
                  </g>
                  <circle cx="176" cy="16" r="5" fill="#cf3b45" />
                  <text x="16" y="20" fontFamily="monospace" fontSize="10" fill="#cf3b45">
                    REC
                  </text>
                  <text x="16" y="105" fontFamily="monospace" fontSize="10" fill="#39FF14">
                    01:42:16
                  </text>
                  <text x="118" y="105" fontFamily="monospace" fontSize="9" fill="#7fa8c2">
                    EAST GATE
                  </text>
                </svg>
                <span className="scan-line" aria-hidden="true" />
              </div>
            </article>

            {/* DNA illustration */}
            <article className="panel w-[calc(50%-6px)] p-3 lg:w-full">
              <CardHead label="DNA profile" />
              <svg viewBox="0 0 200 96" className="block w-full" aria-hidden="true">
                <g fill="none" stroke="#008F5A" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M78 8c30 14-30 30 0 44s30 30 0 44" />
                  <path d="M122 8c-30 14 30 30 0 44s-30 30 0 44" />
                  <path d="M84 24h32M78 44h44M78 66h44M84 84h32" strokeOpacity="0.6" />
                </g>
                <text x="12" y="40" fontFamily="monospace" fontSize="11" fill="#4f6f63">
                  DNA
                </text>
                <text x="12" y="56" fontFamily="monospace" fontSize="9" fill="#008F5A">
                  16 loci
                </text>
              </svg>
            </article>

            {/* Investigation formula */}
            <article className="panel w-[calc(50%-6px)] p-3 lg:w-full">
              <CardHead label="Bayes · prior" />
              <p className="glow-eq font-mono text-[12px] font-semibold text-[#008F5A] sm:text-[13px]">
                P(A|B)=P(B|A)·P(A)/P(B)
              </p>
            </article>
          </div>

          {/* -------------------------------------------------------- CENTRE */}
          <div className="relative order-1 text-center lg:order-2">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-2 h-56 w-56 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(57,255,20,0.22),transparent_65%)] blur-2xl"
            />
            {/* Fingerprint scanning illustration */}
            <div className="relative mx-auto h-40 w-40 sm:h-44 sm:w-44">
              <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true"
                style={{ filter: "drop-shadow(0 0 10px rgba(57,255,20,0.45))" }}>
                <g fill="none" stroke="#008F5A" strokeWidth="3.4" strokeLinecap="round">
                  <path d="M18 66a42 42 0 0 1 84 0" />
                  <path d="M26 72a34 34 0 0 1 68 0" />
                  <path d="M34 78a26 26 0 0 1 52 0" />
                  <path d="M42 84a18 18 0 0 1 36 0" />
                  <path d="M50 90a10 10 0 0 1 20 0" />
                  <path d="M50 66a10 10 0 0 1 20 0c0 12-3 22-8 30" />
                  <path d="M18 66c0 20 6 34 16 44M102 66c0 20-6 34-16 44" />
                  <path d="M34 78c0 16 4 28 12 38" strokeOpacity="0.7" />
                  <path d="M86 78c0 16-4 28-12 38" strokeOpacity="0.7" />
                </g>
              </svg>
              <span className="scan-line" aria-hidden="true" />
              <svg
                viewBox="0 0 120 120"
                className="absolute inset-0 h-full w-full animate-spin"
                style={{ animationDuration: "18s" }}
                aria-hidden="true"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="57"
                  fill="none"
                  stroke="#00C853"
                  strokeOpacity="0.4"
                  strokeWidth="1.5"
                  strokeDasharray="5 9"
                />
              </svg>
            </div>

            <p className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
              <span className="status-pulse relative inline-flex h-2 w-2 rounded-full bg-accent text-accent" />
              Scanning · case file ready
            </p>
            <h1 className="brand-glow mt-3 font-display text-6xl font-bold tracking-tight text-text sm:text-7xl">
              MysteryAI
            </h1>
            <p className="mt-2 font-display text-base font-semibold uppercase tracking-[0.3em] text-accent sm:text-xl sm:tracking-[0.35em]">
              AI Investigation Assistant
            </p>
            <p className="mx-auto mt-4 max-w-md text-sm text-muted sm:text-base">
              Turn raw case material into evidence-grounded findings, timelines,
              contradictions and a structured report — every finding cites the
              evidence behind it.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/register?next=/investigations/new"
                className="cta-glow rounded-full px-8 py-4 font-display text-base font-bold sm:text-lg"
              >
                Start Investigations →
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-border-strong bg-white/70 px-6 py-3.5 text-sm font-semibold text-text transition hover:border-accent"
              >
                Sign in
              </Link>
            </div>
          </div>

          {/* --------------------------------------------------------- RIGHT */}
          <div className="order-3 flex flex-wrap justify-center gap-3 lg:flex-col">
            {/* CCTV camera illustration */}
            <article className="panel w-[calc(50%-6px)] p-3 lg:w-full">
              <CardHead label="Camera · cam-07" />
              <svg viewBox="0 0 200 110" className="block w-full" aria-hidden="true">
                <path
                  d="M138 30l40-14v76l-40-14"
                  fill="#39FF14"
                  fillOpacity="0.12"
                  stroke="#00C853"
                  strokeOpacity="0.5"
                  strokeWidth="1.5"
                />
                <rect x="40" y="26" width="86" height="46" rx="10" fill="#0e2233" stroke="#008F5A" strokeWidth="2.5" />
                <circle cx="112" cy="49" r="14" fill="#06231a" stroke="#00C853" strokeWidth="3" />
                <circle cx="112" cy="49" r="5" fill="#39FF14" />
                <path d="M60 72v22M46 100h34" stroke="#008F5A" strokeWidth="4" strokeLinecap="round" />
                <circle cx="52" cy="36" r="4" fill="#39FF14" />
              </svg>
            </article>

            {/* Footprint evidence photo */}
            <article className="panel w-[calc(50%-6px)] overflow-hidden p-3 lg:w-full">
              <CardHead label="Print · cast" chip="EV-02" />
              <svg viewBox="0 0 200 110" className="block w-full" aria-hidden="true">
                <rect x="1" y="1" width="198" height="108" rx="6" fill="#f2f6f4" stroke="#d5e2da" />
                <path
                  d="M92 14c16 0 26 14 26 32 0 14-7 21-7 33 0 11-9 18-21 18s-21-7-21-19c0-12 6-19 6-32 0-18 1-32 17-32z"
                  fill="#0d2b3e"
                  fillOpacity="0.88"
                />
                <g stroke="#f2f6f4" strokeWidth="3">
                  <path d="M76 34h30M74 48h34M76 62h30" />
                </g>
                <g stroke="#008F5A" strokeWidth="1">
                  <path d="M144 20v70M140 20h8M140 90h8" />
                </g>
                <text x="154" y="58" fontFamily="monospace" fontSize="10" fill="#008F5A">
                  42mm
                </text>
              </svg>
            </article>

            {/* Investigation flowchart */}
            <article className="panel w-[calc(50%-6px)] p-3 lg:w-full">
              <CardHead label="Analysis flow" />
              <svg viewBox="0 0 200 96" className="block w-full" aria-hidden="true">
                <g fill="#ffffff" stroke="#008F5A" strokeWidth="1.5">
                  <rect x="6" y="10" width="54" height="22" rx="6" />
                  <rect x="140" y="10" width="54" height="22" rx="6" />
                  <rect x="6" y="64" width="54" height="22" rx="6" />
                  <rect x="140" y="64" width="54" height="22" rx="6" />
                </g>
                <g fontFamily="monospace" fontSize="8" fill="#0d2b3e" textAnchor="middle">
                  <text x="33" y="24">REPORT</text>
                  <text x="167" y="24">FINDINGS</text>
                  <text x="33" y="78">EVIDENCE</text>
                  <text x="167" y="78">TIMELINE</text>
                </g>
                <g fill="none" stroke="#00C853" strokeWidth="1.6">
                  <path className="connection-line" d="M60 21 L84 42" />
                  <path className="connection-line" d="M140 21 L116 42" style={{ animationDelay: "-0.6s" }} />
                  <path className="connection-line" d="M60 75 L84 54" style={{ animationDelay: "-1.2s" }} />
                  <path className="connection-line" d="M140 75 L116 54" style={{ animationDelay: "-1.8s" }} />
                </g>
                <circle cx="100" cy="48" r="16" fill="#0e2233" stroke="#39FF14" strokeWidth="2" />
                <text x="100" y="52" fontFamily="monospace" fontSize="10" fill="#39FF14" textAnchor="middle">
                  AI
                </text>
              </svg>
            </article>

            {/* Magnified fingerprint */}
            <article className="panel w-[calc(50%-6px)] p-3 lg:w-full">
              <CardHead label="Print · magnified" />
              <svg viewBox="0 0 170 160" className="mx-auto block h-36 w-full" aria-hidden="true">
                <circle cx="70" cy="66" r="52" fill="#ffffff" fillOpacity="0.85" stroke="#008F5A" strokeWidth="4" />
                <circle
                  cx="70"
                  cy="66"
                  r="60"
                  fill="none"
                  stroke="#39FF14"
                  strokeOpacity="0.45"
                  strokeWidth="1.5"
                  strokeDasharray="4 8"
                />
                <g fill="none" stroke="#008F5A" strokeWidth="3" strokeLinecap="round">
                  <path d="M44 72a26 26 0 0 1 52 0" />
                  <path d="M50 78a20 20 0 0 1 40 0" />
                  <path d="M56 84a14 14 0 0 1 28 0" />
                  <path d="M62 90a8 8 0 0 1 16 0" />
                  <path d="M62 72a8 8 0 0 1 16 0c0 9-2 16-6 22" />
                </g>
                <path d="M106 104l38 38" stroke="#0d2b3e" strokeWidth="10" strokeLinecap="round" />
                <path d="M106 104l38 38" stroke="#008F5A" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </article>

            {/* Question mark + coordinates */}
            <div className="panel flex w-[calc(50%-6px)] items-center justify-between gap-2 p-3 font-mono text-[10px] text-muted lg:w-full sm:text-[11px]">
              <span className="font-display text-2xl leading-none text-[#008F5A]">?</span>
              <span>40.7128°N 74.0060°W</span>
            </div>
          </div>
        </div>

        {/* Capability strip */}
        <p className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted sm:text-[11px]">
          <span>Evidence-grounded findings</span>
          <span className="text-[#00C853]">◆</span>
          <span>Timeline &amp; connections</span>
          <span className="text-[#00C853]">◆</span>
          <span>Facts vs hypotheses</span>
          <span className="text-[#00C853]">◆</span>
          <span>Downloadable report</span>
        </p>
      </section>

      <footer className="border-t border-border bg-white/60 px-6 py-5 text-center text-xs text-muted backdrop-blur">
        MysteryAI · AI investigation assistant —{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>{" "}
        ·{" "}
        <Link href="/register" className="font-medium text-accent hover:underline">
          Create account
        </Link>
      </footer>
    </main>
  );
}
