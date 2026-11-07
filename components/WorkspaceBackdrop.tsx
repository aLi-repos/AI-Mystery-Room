/**
 * Decorative investigator-workspace backdrop.
 *
 * Pure server-rendered markup (no client JS): sparse mathematical symbols,
 * question marks, coordinates and evidence/alert markers floating over the
 * CSS checkerboard. Pointer-events are disabled and the layer is hidden
 * from assistive tech — it never interferes with content or input.
 */

type Piece = {
  text?: string;
  svg?: "crosshair" | "pin" | "alert";
  top: string;
  left: string;
  rotate?: number;
  size: number;
  tone: "ink" | "teal" | "muted" | "evidence" | "danger";
  hideSm?: boolean;
};

const TONES: Record<Piece["tone"], string> = {
  ink: "text-[#0d2b3e]",
  teal: "text-[#0b7f7a]",
  muted: "text-[#55717f]",
  evidence: "text-[#f2c200]",
  danger: "text-[#cf3b45]",
};

const PIECES: Piece[] = [
  { text: "?", top: "6%", left: "4%", size: 96, tone: "teal", rotate: -12 },
  { text: "P(A|B)", top: "14%", left: "86%", size: 26, tone: "muted", hideSm: true },
  { svg: "crosshair", top: "26%", left: "92%", size: 44, tone: "muted", hideSm: true },
  { text: "∑x² = np", top: "48%", left: "3%", size: 24, tone: "muted", rotate: -6, hideSm: true },
  { text: "?", top: "70%", left: "8%", size: 64, tone: "ink", rotate: 10 },
  { svg: "pin", top: "60%", left: "93%", size: 34, tone: "evidence", hideSm: true },
  { text: "Δt", top: "84%", left: "46%", size: 30, tone: "teal", hideSm: true },
  { text: "∀x", top: "90%", left: "78%", size: 26, tone: "muted", hideSm: true },
  { text: "?", top: "38%", left: "95%", size: 44, tone: "muted", rotate: 8, hideSm: true },
  { svg: "alert", top: "34%", left: "1.5%", size: 30, tone: "danger", hideSm: true },
  { text: "01:42:16", top: "78%", left: "90%", size: 18, tone: "muted", hideSm: true },
  { text: "√2", top: "20%", left: "72%", size: 34, tone: "teal", rotate: -4, hideSm: true },
];

function Glyph({ kind }: { kind: NonNullable<Piece["svg"]> }) {
  if (kind === "crosshair") {
    return (
      <svg viewBox="0 0 48 48" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="24" cy="24" r="15" />
        <path d="M24 2v12M24 34v12M2 24h12M34 24h12" />
        <circle cx="24" cy="24" r="3" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === "pin") {
    return (
      <svg viewBox="0 0 32 40" width="1em" height="1em" fill="currentColor" aria-hidden="true">
        <path d="M16 0C7.2 0 0 7.2 0 16c0 11 16 24 16 24s16-13 16-24C32 7.2 24.8 0 16 0zm0 22a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M16 3 30 28H2L16 3z" strokeLinejoin="round" />
      <path d="M16 13v7" strokeLinecap="round" />
      <circle cx="16" cy="24" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function WorkspaceBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none">
      {PIECES.map((piece, i) => (
        <span
          key={i}
          className={`absolute font-display leading-none ${TONES[piece.tone]} ${
            piece.hideSm ? "hidden md:inline" : "inline"
          }`}
          style={{
            top: piece.top,
            left: piece.left,
            fontSize: piece.size,
            opacity: piece.tone === "evidence" || piece.tone === "danger" ? 0.4 : 0.16,
            transform: `rotate(${piece.rotate ?? 0}deg)`,
          }}
        >
          {piece.svg ? <Glyph kind={piece.svg} /> : piece.text}
        </span>
      ))}
    </div>
  );
}
