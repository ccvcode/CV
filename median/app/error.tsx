"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-[1320px] px-4 py-24 sm:px-8">
      <div className="max-w-2xl border-t-2 border-rule-strong pt-4">
        <h1 className="section-head text-[44px]">Ceva nu a mers</h1>
        <p className="dek mt-4 text-[20px]">Nu am putut încărca pagina. Încearcă din nou.</p>
        <button onClick={reset} className="ui mt-6 bg-ink px-5 py-2.5 text-[13px] font-semibold uppercase tracking-wider text-on-ink">
          Reîncearcă
        </button>
      </div>
    </main>
  );
}
