"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-bold">Ceva n-a mers bine</h1>
      <p className="mt-3 text-ink-muted">Nu am putut încărca știrile. Încearcă din nou în câteva secunde.</p>
      <button onClick={reset} className="mt-8 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bg">
        Reîncearcă
      </button>
    </main>
  );
}
