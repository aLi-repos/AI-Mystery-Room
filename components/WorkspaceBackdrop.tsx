/**
 * Decorative forensic workspace backdrop.
 *
 * Pure server-rendered markup (no client JS): fingerprints, CCTV indicators,
 * DNA strands, question marks, coordinates and evidence/alert markers
 * floating over the CSS checkerboard — with slow float / neon glow
 * animations (both disabled by prefers-reduced-motion). Pointer-events are
 * disabled and the layer is hidden from assistive tech.
 */

type Piece = {
  text?: string;
  svg?: "fingerprint" | "cctv" | "dna" | "crosshair" | "pin" | "alert";
  top: string;
  left: string;
  rotate?: number;
  size: number;
  tone: "navy" | "green" | "muted" | "evidence" | "danger";
  anim?: "float-slow" | "float-slower" | "glow-eq";
  hideSm?: boolean;
};

const TONES: Record<Piece["tone"], string> = {
  navy: "text-[#0d2b3e]",
  green: "text-[#008F5A]",
  muted: "text-[#4f6f63]",
  evidence: "text-[#F2C200]",
  danger: "text-[#cf3b45]",
};

const PIECES: Piece[] = [
  { svg: "fingerprint", top: "5%", left: "3%", size: 74, tone: "green", anim: "float-slower" },
  { text: "?", top: "13%", left: "87%", size: 88, tone: "green", rotate: -10, anim: "glow-eq" },
  { text: "P(A|B)", top: "22%", left: "74%", size: 24, tone: "green", anim: "glow-eq", hideSm: true },
  { svg: "cctv", top: "27%", left: "91%", size: 52, tone: "muted", anim: "float-slow", hideSm: true },
  { text: "Σx²=np(1−p)", top: "47%", left: "2%", size: 22, tone: "muted", rotate: -5, anim: "glow-eq", hideSm: true },
  { svg: "dna", top: "58%", left: "5%", size: 64, tone: "green", anim: "float-slower", hideSm: true },
  { text: "?", top: "72%", left: "8%", size: 56, tone: "navy", rotate: 12, anim: "float-slow" },
  { svg: "pin", top: "63%", left: "93%", size: 34, tone: "evidence", anim: "float-slow", hideSm: true },
  { text: "Δt = t₂ − t₁", top: "84%", left: "76%", size: 22, tone: "green", anim: "glow-eq", hideSm: true },
  { text: "40.7128°N", top: "90%", left: "40%", size: 18, tone: "muted", hideSm: true },
  { svg: "crosshair", top: "36%", left: "96%", size: 40, tone: "muted", anim: "float-slow", hideSm: true },
  { text: "?", top: "41%", left: "1.5%", size: 40, tone: "muted", rotate: 8, hideSm: true },
  { svg: "alert", top: "80%", left: "12%", size: 28, tone: "danger", hideSm: true },
  { text: "01:42:16", top: "52%", left: "90%", size: 17, tone: "muted", hideSm: true },
];

function Glyph({ kind }: { kind: NonNullable<Piece["svg"]> }) {
  switch (kind) {
    case "fingerprint":
      return (
        <svg viewBox="0 0 64 64" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 38a20 20 0 0 1 40 0M17 42a15 15 0 0 1 30 0M22 46a10 10 0 0 1 20 0M27 49a5 5 0 0 1 10 0" />
          <path d="M27 38a5 5 0 0 1 10 0c0 6-1 10-3 13" />
          <path d="M12 38c0 9 3 15 7 19M52 38c0 9-3 15-7 19" />
        </svg>
      );
    case "cctv":
      return (
        <svg viewBox="0 0 56 48" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 12h30l12 10v12H14L6 24z" />
          <path d="M20 34v6M12 42h20" />
          <circle cx="42" cy="22" r="3" fill="#00C853" stroke="none" />
          <circle cx="50" cy="8" r="4" fill="#39FF14" fillOpacity="0.7" stroke="none" />
        </svg>
      );
    case "dna":
      return (
        <svg viewBox="0 0 48 64" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 4c16 10 16 46 0 56M36 4c-16 10-16 46 0 56" />
          <path d="M15 14h18M12 26h24M12 38h24M15 50h18" />
        </svg>
      );
    case "crosshair":
      return (
        <svg viewBox="0 0 48 48" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="24" cy="24" r="15" />
          <path d="M24 2v12M24 34v12M2 24h12M34 24h12" />
          <circle cx="24" cy="24" r="3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "pin":
      return (
        <svg viewBox="0 0 32 40" width="1em" height="1em" fill="currentColor" aria-hidden="true">
          <path d="M16 0C7.2 0 0 7.2 0 16c0 11 16 24 16 24s16-13 16-24C32 7.2 24.8 0 16 0zm0 22a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 32 32" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M16 3 30 28H2L16 3z" strokeLinejoin="round" />
          <path d="M16 13v7" strokeLinecap="round" />
          <circle cx="16" cy="24" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

export default function WorkspaceBackdrop() {
  return (
    <div aria-hidden="true" data-backdrop className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none">
      {/* Moving evidence-connection line — dashed, flowing */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          className="connection-line"
          d="M0 30 L28 30 L44 52 L72 52 L86 34 L100 34"
          fill="none"
          stroke="#00C853"
          strokeOpacity="0.28"
          strokeWidth="0.35"
          vectorEffect="non-scaling-stroke"
        />
        <path
          className="connection-line"
          style={{ animationDelay: "-1.2s" }}
          d="M0 72 L22 72 L40 86 L66 86 L82 68 L100 68"
          fill="none"
          stroke="#39FF14"
          strokeOpacity="0.22"
          strokeWidth="0.35"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {PIECES.map((piece, i) => (
        <span
          key={i}
          className={`absolute font-display leading-none ${TONES[piece.tone]} ${piece.anim ?? ""} ${
            piece.hideSm ? "hidden md:inline" : "inline"
          }`}
          style={
            {
              top: piece.top,
              left: piece.left,
              fontSize: piece.size,
              opacity:
                piece.tone === "evidence" || piece.tone === "danger"
                  ? 0.5
                  : piece.tone === "navy"
                    ? 0.14
                    : 0.32,
              transform: `rotate(${piece.rotate ?? 0}deg)`,
              "--rot": `${piece.rotate ?? 0}deg`,
            } as React.CSSProperties
          }
        >
          {piece.svg ? <Glyph kind={piece.svg} /> : piece.text}
        </span>
      ))}
    </div>
  );
}
