import type { Metadata } from "next";
import { LiveFeed } from "@/components/LiveFeed";
import { LiveUpdater } from "@/components/LiveUpdater";
import { getState } from "@/lib/store";

// Știrile stau în memoria serverului, deci randarea e rapidă: servim mereu varianta la zi.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pe scurt — știri live, minut cu minut", description: "Toate știrile preluate de Median, în ordine cronologică, actualizate automat la fiecare 5 minute." };

export default async function Live() {
  const state = await getState();
  const items = state.articles.slice(0, 250).map(({ id, slug, title, sourceName, sourceSite, category, published, image }) => ({ id, slug, title, sourceName, sourceSite, category, published, image }));
  return (
    <main className="mx-auto max-w-4xl px-4 pb-10 pt-8 sm:px-6">
      <LiveUpdater since={state.updatedAt} />
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-breaking">
        <span className="pulse-dot h-2 w-2 rounded-full bg-breaking text-breaking" /> Live
      </div>
      <h1 className="font-display mt-1 text-4xl font-black sm:text-5xl">Pe scurt</h1>
      <p className="mt-2 text-ink-muted">Toate știrile, în ordinea în care apar. Fluxul se actualizează automat la fiecare 5 minute.</p>
      <LiveFeed items={items} />
    </main>
  );
}
