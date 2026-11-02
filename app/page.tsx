import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-bg text-text">
      <h1 className="font-display text-5xl md:text-7xl tracking-tight text-center">MysteryAI</h1>
      <p className="mt-6 text-xl text-muted text-center max-w-xl">The AI Mystery Room — solve a five-stage locked-room case under the clock, with progressive hints and live scoring.</p>
      <div className="mt-10 flex gap-4">
        <Link href="/register" className="px-6 py-3 rounded-lg bg-accent text-bg font-bold hover:brightness-110 transition">Play Now</Link>
        <Link href="/login" className="px-6 py-3 rounded-lg border border-border hover:bg-surface transition">Log In</Link>
      </div>

    </main>
  );
}
