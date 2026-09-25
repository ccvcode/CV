import type { Metadata } from "next";
import { Search } from "lucide-react";
import { CompactCard } from "@/components/Cards";
import { search } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Caută", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const results = q ? await search(q) : [];
  return (
    <main className="mx-auto max-w-3xl px-4 pb-10 pt-8 sm:px-6">
      <h1 className="font-display text-4xl font-black">Caută</h1>
      <form action="/cauta" className="mt-5 flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 focus-within:border-brand">
        <Search className="h-5 w-5 text-ink-muted" />
        <input name="q" defaultValue={q} autoFocus={!q} placeholder="Ex: Guvern, BNR, Superliga…" className="h-14 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-ink-faint" />
        <button className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-bg">Caută</button>
      </form>
      {q && (
        <p className="mt-6 text-sm text-ink-muted">
          {results.length ? (
            <>
              {results.length} rezultate pentru <b className="text-ink">„{q}”</b>
            </>
          ) : (
            <>Niciun rezultat pentru „{q}”. Încearcă alți termeni.</>
          )}
        </p>
      )}
      <div className="mt-2 divide-y divide-line">
        {results.map((a) => (
          <CompactCard key={a.id} article={a} />
        ))}
      </div>
    </main>
  );
}
