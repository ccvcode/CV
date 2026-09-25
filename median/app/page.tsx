import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";
import { BreakingTicker } from "@/components/BreakingTicker";
import { CompactCard, LeadCard, NumberedItem, OverlayCard, StandardCard, TimelineItem } from "@/components/Cards";
import { LiveUpdater } from "@/components/LiveUpdater";
import { SectionHeader } from "@/components/SectionHeader";
import { QuakesWidget, RatesWidget, WeatherWidget } from "@/components/Widgets";
import { Favicon } from "@/components/Favicon";
import { CATEGORIES } from "@/lib/categories";
import { OUTLETS } from "@/lib/sources";
import { getClusters, getMostRead, getState } from "@/lib/store";
import type { Cluster } from "@/lib/types";
import { getQuakes, getRates, getWeather } from "@/lib/widgets";

export const revalidate = 300;

export default async function Home() {
  const [state, clusters, mostRead, rates, weather, quakes] = await Promise.all([
    getState(),
    getClusters({ hours: 30 }),
    getMostRead(8),
    getRates(),
    getWeather(),
    getQuakes(),
  ]);

  const used = new Set<string>();
  const take = (list: Cluster[], n: number, needImage = false) => {
    const out: Cluster[] = [];
    for (const c of list) {
      if (out.length >= n) break;
      if (used.has(c.id) || (needImage && !c.lead.image && !state.demo)) continue;
      used.add(c.id);
      out.push(c);
    }
    return out;
  };

  const [lead] = take(clusters, 1, true);
  const secondary = take(clusters, 2, true);
  const top = take(clusters, 8);
  // În fluxul „Pe scurt” de pe prima pagină afișăm un singur articol per subiect.
  const seenTopics = new Set<string>();
  const latest = state.articles
    .filter((a) => {
      const k = a.clusterId ?? a.id;
      if (seenTopics.has(k)) return false;
      seenTopics.add(k);
      return true;
    })
    .slice(0, 14);
  const breaking = state.articles.filter((a) => ["national", "politica", "international", "economie"].includes(a.category)).slice(0, 12);
  const photos = state.articles.filter((a) => a.image).slice(0, 12);

  const rails = await Promise.all(
    CATEGORIES.map(async (c) => ({ category: c, clusters: (await getClusters({ category: c.slug, hours: 72 })).filter((x) => !used.has(x.id)).slice(0, 5) }))
  );

  const visibleRails = rails.filter((r) => r.clusters.length >= 2);
  const stripAt = Math.min(2, visibleRails.length - 1);

  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6">
      <LiveUpdater since={state.updatedAt} />
      <BreakingTicker articles={breaking} />

      {/* Hero bento */}
      {lead && (
        <section className="mt-6 grid gap-5 lg:grid-cols-12" aria-label="Subiectele principale">
          <div className="lg:col-span-8">
            <LeadCard cluster={lead} priority />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1 lg:grid-rows-[1fr_1fr]">
            {secondary.map((c) => (
              <OverlayCard key={c.id} article={c.lead} className="min-h-[240px]" />
            ))}
          </div>
        </section>
      )}

      {/* Top stories */}
      <section className="mt-14">
        <SectionHeader title="Subiectele zilei" kicker="Cele mai relatate știri" />
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {top.map((c, i) => (
            <StandardCard key={c.id} cluster={c} priority={i < 4} />
          ))}
        </div>
      </section>

      {/* Live + sidebar */}
      <section className="mt-16 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SectionHeader title="Pe scurt" kicker="Fluxul live al știrilor" href="/live" color="var(--breaking)" />
          <ol>
            {latest.map((a) => (
              <TimelineItem key={a.id} article={a} />
            ))}
          </ol>
          <Link href="/live" className="ml-[64px] inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bg transition hover:opacity-90">
            <Radio className="h-4 w-4" /> Toate știrile, minut cu minut
          </Link>
        </div>
        <aside className="space-y-6 lg:col-span-5">
          <div className="rounded-3xl border border-line bg-surface p-5">
            <h2 className="font-display text-xl font-bold">{mostRead.byViews ? "Cele mai citite" : "Cele mai mediatizate"}</h2>
            <p className="text-xs text-ink-muted">{mostRead.byViews ? "Pe Median, în ultimele 24 de ore" : "Subiectele relatate de cele mai multe surse azi"}</p>
            <ol className="mt-2">
              {mostRead.articles.map((a, i) => (
                <NumberedItem key={a.id} article={a} n={i + 1} />
              ))}
            </ol>
          </div>
          {weather && <WeatherWidget data={weather} />}
          {rates && <RatesWidget data={rates} />}
        </aside>
      </section>

      {/* Category rails */}
      {visibleRails.map(({ category, clusters: cs }, idx) => {
          const [feature, ...rest] = cs;
          const flip = idx % 2 === 1;
          return (
            <section key={category.slug} className="mt-16">
              <SectionHeader title={category.label} href={`/categorie/${category.slug}`} color={category.color} />
              <div className="grid gap-8 lg:grid-cols-12">
                <div className={flip ? "lg:order-2 lg:col-span-7" : "lg:col-span-7"}>
                  <StandardCard cluster={feature} className="[&_h3]:text-2xl [&_h3]:sm:text-3xl" />
                </div>
                <div className={`divide-y divide-line lg:col-span-5 ${flip ? "lg:order-1" : ""}`}>
                  {rest.map((c) => (
                    <CompactCard key={c.id} cluster={c} showCategory={false} />
                  ))}
                </div>
              </div>
              {idx === stripAt && photos.length > 4 && <PhotoStrip photos={photos} />}
            </section>
          );
        })}

      {/* Quakes + sources */}
      <section className="mt-16 grid gap-6 lg:grid-cols-12">
        {quakes && (
          <div className="lg:col-span-4">
            <QuakesWidget data={quakes} />
          </div>
        )}
        <div className={`relative overflow-hidden rounded-3xl bg-brand p-7 text-white ${quakes ? "lg:col-span-8" : "lg:col-span-12"}`}>
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Transparență</div>
          <h2 className="font-display mt-1 text-3xl font-bold">Agregăm {OUTLETS.length} publicații, {state.sourcesTotal} fluxuri</h2>
          <p className="mt-2 max-w-xl text-sm text-white/85">
            La fiecare 5 minute, Median verifică automat toate sursele și grupează articolele despre același subiect, ca să vezi dintr-o privire cine ce relatează.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {OUTLETS.slice(0, 18).map((o) => (
              <span key={o.name} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium">
                <Favicon name={o.name} site={o.site} size={14} /> {o.name}
              </span>
            ))}
          </div>
          <Link href="/surse" className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand">
            Vezi toate sursele <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

function PhotoStrip({ photos }: { photos: import("@/lib/types").Article[] }) {
  return (
    <div className="-mx-4 mt-16 bg-[#0e0f12] px-4 py-10 text-white sm:-mx-6 sm:rounded-3xl sm:px-6">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-white/50">Galerie</div>
          <h2 className="font-display text-2xl font-bold">Ziua în imagini</h2>
        </div>
        <span className="hidden text-xs text-white/50 sm:block">Glisează →</span>
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        {photos.map((a) => (
          <OverlayCard key={a.id} article={a} className="h-[340px] w-[78vw] shrink-0 snap-start sm:w-[340px]" />
        ))}
      </div>
    </div>
  );
}
