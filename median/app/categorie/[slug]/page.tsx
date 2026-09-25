import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CompactCard, LeadCard, StandardCard, TimelineItem } from "@/components/Cards";
import { LiveUpdater } from "@/components/LiveUpdater";
import { SectionHeader } from "@/components/SectionHeader";
import { getCategory } from "@/lib/categories";
import { getArticles, getClusters, getState } from "@/lib/store";

// Știrile stau în memoria serverului, deci randarea e rapidă: servim mereu varianta la zi.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = getCategory((await params).slug);
  if (!c) return {};
  return { title: `Știri ${c.label}`, description: c.description, alternates: { canonical: `/categorie/${c.slug}` } };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = getCategory((await params).slug);
  if (!c) notFound();
  const [state, clusters, latest] = await Promise.all([getState(), getClusters({ category: c.slug, hours: 96 }), getArticles({ category: c.slug, limit: 40 })]);
  const withImg = clusters.filter((x) => x.lead.image || state.demo);
  const lead = withImg[0] ?? clusters[0];
  const rest = clusters.filter((x) => x !== lead);
  const grid = rest.slice(0, 6);
  const compact = rest.slice(6, 16);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6">
      <LiveUpdater since={state.updatedAt} />
      <header className="relative mb-8 overflow-hidden rounded-3xl p-6 sm:p-10" style={{ background: `linear-gradient(135deg, ${c.color}1f, ${c.color}08)` }}>
        <CategoryIcon slug={c.slug} className="absolute -right-6 -top-6 h-48 w-48 opacity-10" style={{ color: c.color }} strokeWidth={1} />
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: c.color }}>
          Categorie
        </div>
        <h1 className="font-display mt-1 text-4xl font-black sm:text-6xl">{c.label}</h1>
        <p className="mt-3 max-w-2xl text-ink-muted">{c.description}</p>
        <p className="mt-4 text-xs text-ink-faint">{latest.length} articole recente · actualizat automat la 5 minute</p>
      </header>

      {!lead ? (
        <p className="py-20 text-center text-ink-muted">Nu există încă articole în această categorie. Revino în câteva minute.</p>
      ) : (
        <>
          <LeadCard cluster={lead} priority />
          <div className="mt-12 grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2">
                {grid.map((x, i) => (
                  <StandardCard key={x.id} cluster={x} priority={i < 2} />
                ))}
              </div>
              {compact.length > 0 && (
                <div className="mt-12">
                  <SectionHeader title="Mai multe știri" color={c.color} />
                  <div className="grid gap-x-8 divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
                    {compact.map((x) => (
                      <div key={x.id} className="border-line sm:border-b">
                        <CompactCard cluster={x} showCategory={false} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <aside className="lg:col-span-4">
              <div className="sticky top-32">
                <SectionHeader title="Ultimele" color={c.color} />
                <ol>
                  {latest.slice(0, 12).map((a) => (
                    <TimelineItem key={a.id} article={a} />
                  ))}
                </ol>
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
