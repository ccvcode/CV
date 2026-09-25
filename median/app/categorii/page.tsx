import Link from "next/link";
import type { Metadata } from "next";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CATEGORIES } from "@/lib/categories";
import { getState } from "@/lib/store";

// Știrile stau în memoria serverului, deci randarea e rapidă: servim mereu varianta la zi.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Categorii" };

export default async function Categories() {
  const { articles } = await getState();
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c.slug, articles.filter((a) => a.category === c.slug).length]));
  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6">
      <h1 className="font-display text-4xl font-black">Categorii</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/categorie/${c.slug}`}
            className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: c.color }}>
              <CategoryIcon slug={c.slug} className="h-5 w-5" />
            </span>
            <div className="mt-4 font-display text-xl font-bold">{c.label}</div>
            <div className="text-xs text-ink-muted">{counts[c.slug]} articole</div>
            <CategoryIcon slug={c.slug} className="absolute -bottom-4 -right-4 h-24 w-24 opacity-[0.06] transition group-hover:scale-110" />
          </Link>
        ))}
      </div>
    </main>
  );
}
