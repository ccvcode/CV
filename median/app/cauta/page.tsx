import type { Metadata } from "next";
import { StoryRow } from "@/components/story";
import { searchStories } from "@/lib/data/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Căutare", robots: { index: false } };

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const results = q ? searchStories(q) : [];
  return (
    <main className="mx-auto max-w-[1320px] px-4 sm:px-8">
      <form action="/cauta" className="max-w-3xl pt-10">
        <label htmlFor="q" className="kicker text-ink-3">
          Caută în arhiva Median
        </label>
        <div className="mt-2 flex items-end gap-4 border-b-2 border-rule-strong">
          <input id="q" name="q" defaultValue={q} autoFocus={!q} placeholder="ex. buget, Ucraina" className="hl min-w-0 flex-1 bg-transparent py-2 text-[34px] outline-none placeholder:text-ink-3 sm:text-[44px]" />
          <button className="ui mb-3 text-[13px] font-semibold uppercase tracking-wider">Caută</button>
        </div>
      </form>
      {q && (
        <p className="meta mt-6">
          {results.length ? `${results.length} rezultate pentru „${q}”` : `Niciun rezultat pentru „${q}”. Căutarea ignoră diacriticele; încearcă alți termeni.`}
        </p>
      )}
      <div className="mt-4 grid max-w-4xl">
        {results.map((s) => (
          <StoryRow key={s.id} story={s} thumb className="border-b border-rule py-4" />
        ))}
      </div>
    </main>
  );
}
