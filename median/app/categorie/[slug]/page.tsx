import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveUpdater } from "@/components/live-updater";
import { SectionHead } from "@/components/section";
import { StoryBlock, StoryRow } from "@/components/story";
import { getCategory, REGION_MAP, REGIONS } from "@/lib/core/categories";
import type { RegionSlug } from "@/lib/core/types";
import { cx } from "@/lib/core/utils";
import { latestStories, topStories } from "@/lib/data/queries";

export const dynamic = "force-dynamic";
const PER_PAGE = 24;

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ regiune?: string }> }): Promise<Metadata> {
  const c = getCategory((await params).slug);
  if (!c) return {};
  const r = (await searchParams).regiune as RegionSlug | undefined;
  const region = r && REGION_MAP[r] ? REGION_MAP[r].label : undefined;
  return {
    title: region ? `${c.label}: ${region}` : `Știri ${c.label}`,
    description: c.description,
    alternates: { canonical: `/categorie/${c.slug}${region ? `?regiune=${r}` : ""}`, types: { "application/rss+xml": `/rss.xml?categorie=${c.slug}` } },
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ regiune?: string; pagina?: string }> }) {
  const c = getCategory((await params).slug);
  if (!c) notFound();
  const sp = await searchParams;
  const region = sp.regiune && REGION_MAP[sp.regiune as RegionSlug] ? (sp.regiune as RegionSlug) : undefined;
  const page = Math.max(1, Number(sp.pagina) || 1);

  const used = new Set<string>();
  const top = page === 1 ? topStories({ category: c.slug, region, limit: 5, hours: 72, exclude: used }) : [];
  const list = latestStories({ category: c.slug, region, limit: PER_PAGE + 1, offset: (page - 1) * PER_PAGE }).filter((s) => !used.has(s.id));
  const hasMore = list.length > PER_PAGE;
  const [lead, ...second] = top;
  const qs = (p: number) => `/categorie/${c.slug}?${new URLSearchParams({ ...(region ? { regiune: region } : {}), pagina: String(p) })}`;

  return (
    <main className="mx-auto max-w-[1320px] px-4 sm:px-8">
      <LiveUpdater since={Date.now()} />
      <header className="pt-10">
        <h1 className="section-head text-[48px] sm:text-[88px]">{region ? REGION_MAP[region].label : c.label}</h1>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b-2 border-rule-strong pb-3">
          <p className="dek max-w-2xl text-[19px]">{region ? `${c.label} · ${REGION_MAP[region].label}` : c.description}</p>
          <a href={`/rss.xml?categorie=${c.slug}`} className="ui text-[12px] font-semibold uppercase tracking-wider text-ink-2 hover:text-ink">
            RSS
          </a>
        </div>
        {c.slug === "international" && (
          <nav className="ui no-scrollbar flex gap-5 overflow-x-auto whitespace-nowrap border-b border-rule py-3 text-[14px] font-semibold">
            <Link href="/categorie/international" className={cx(!region ? "text-ink" : "text-ink-2 hover:text-ink")}>
              <span className={cx("border-b-2 pb-[3px]", !region ? "border-accent" : "border-transparent")}>Toate</span>
            </Link>
            {REGIONS.map((r) => (
              <Link key={r.slug} href={`/categorie/international?regiune=${r.slug}`} className={cx(region === r.slug ? "text-ink" : "text-ink-2 hover:text-ink")}>
                <span className={cx("border-b-2 pb-[3px]", region === r.slug ? "border-accent" : "border-transparent")}>{r.label}</span>
              </Link>
            ))}
          </nav>
        )}
      </header>

      {!lead && !list.length && <p className="dek py-20 text-[20px]">Încă nu există articole aici. Revino în câteva minute.</p>}

      {lead && (
        <section className="mt-8 grid gap-6 lg:grid-cols-12">
          <StoryBlock story={lead} size="xl" ratio="3/2" dek priority sizes="(max-width: 1024px) 100vw, 760px" className="lg:col-span-7" />
          <div className="grid gap-6 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1 lg:border-l lg:border-rule lg:pl-6">
            {second.slice(0, 4).map((s) => (
              <StoryRow key={s.id} story={s} thumb kicker={false} className="border-b border-rule pb-5 last:border-0" />
            ))}
          </div>
        </section>
      )}

      {list.length > 0 && (
        <section className="mt-14">
          <SectionHead title={page === 1 ? "Cele mai noi" : `Pagina ${page}`} size="md" />
          <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {list.slice(0, PER_PAGE).map((s) => (
              <StoryRow key={s.id} story={s} thumb kicker={c.slug === "international"} className="border-b border-rule py-4" />
            ))}
          </div>
          <nav className="ui mt-8 flex justify-between text-[14px] font-semibold">
            {page > 1 ? <Link href={qs(page - 1)}>← Mai noi</Link> : <span />}
            {hasMore && <Link href={qs(page + 1)}>Mai vechi →</Link>}
          </nav>
        </section>
      )}
    </main>
  );
}
