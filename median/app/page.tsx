import Link from "next/link";
import { Figure } from "@/components/figure";
import { LiveUpdater } from "@/components/live-updater";
import { Markets } from "@/components/markets";
import { Weather } from "@/components/weather";
import { SectionHead } from "@/components/section";
import { Kicker, leadClass, listImage, Meta, StoryBlock, StoryLink, StoryRow, sourcesLabel } from "@/components/story";
import { Clock } from "@/components/time";
import { Ticker } from "@/components/ticker";
import { REGION_MAP, REGIONS } from "@/lib/core/categories";
import type { CategorySlug } from "@/lib/core/types";
import { breakingStories, distinctStories, relatedStories, sharesName, latestStories, mostRead, topStories, type StoryCard } from "@/lib/data/queries";
import { getRates, getWeather } from "@/lib/data/widgets";

export const dynamic = "force-dynamic";

const withPhoto = (list: StoryCard[]) => list.filter((s) => listImage(s));

export default async function Home() {
  const used = new Set<string>();
  const pool = topStories({ limit: 30, hours: 36 });
  if (!pool.length) return <EmptyState />;

  // Știrea principală: un subiect relatat în ultimele 12 ore; dintre primele trei ca importanță, primul
  // cu o poză destul de mare pentru locul mare (≥1000px), altfel primul cu poză. Apoi 4 secundare.
  const bigPhoto = (s: StoryCard) => (listImage(s)?.maxWidth ?? 0) >= 1000;
  const fresh = pool.filter((s) => Date.now() - s.updated < 12 * 3600_000);
  const lead = fresh.slice(0, 3).find(bigPhoto) ?? withPhoto(fresh)[0] ?? withPhoto(pool)[0] ?? pool[0];
  used.add(lead.id);
  // Sub știrea principală: doar subiecte cu adevărat legate de ea (nume comun, cuvinte rare comune), recente.
  const related = distinctStories(
    relatedStories(lead.id, 6).filter((s) => Date.now() - s.updated < 36 * 3600_000),
    [lead]
  ).slice(0, 2);
  related.forEach((s) => used.add(s.id));
  // Secundarele nu repetă subiectul principal cu alte cuvinte și cel mult una e despre aceeași persoană.
  let sameName = 0;
  const secondary = distinctStories(
    [...withPhoto(pool), ...pool].filter((s, i, a) => !used.has(s.id) && a.findIndex((x) => x.id === s.id) === i),
    [lead, ...related]
  )
    .filter((s) => !sharesName(s.title, lead.title) || sameName++ < 1)
    .slice(0, 4);
  secondary.forEach((s) => used.add(s.id));

  const breaking = breakingStories(8);
  const [rates, weather] = await Promise.all([getRates().catch(() => null), getWeather().catch(() => null)]);

  // Secțiunile nu repetă știrile deja afișate; prima știre a secțiunii este una cu poză (dintre primele trei).
  const section = (category: CategorySlug, limit: number, hours = 72) => {
    const list = distinctStories(topStories({ category, limit: limit + 2, hours, exclude: used }), [lead]).slice(0, limit);
    const i = list.slice(0, 3).findIndex((s) => listImage(s));
    if (i > 0) list.unshift(...list.splice(i, 1));
    return list;
  };
  const intl = section("international", 11, 48);
  const politica = section("politica", 5);
  const national = section("national", 5);
  const economie = section("economie", 5);
  const sport = section("sport", 7);
  const tech = section("tech", 5);
  const sanatate = section("sanatate", 5);
  const auto = section("auto", 5);
  const cultura = section("cultura", 4, 120);
  const lifestyle = section("lifestyle", 3, 120);
  const monden = section("monden", 4, 96);
  // „Pe scurt” și „Cele mai relatate” arată doar ce nu apare deja în altă parte a paginii.
  const latest = latestStories({ limit: 60 }).filter((s) => !used.has(s.id)).slice(0, 8);
  latest.forEach((s) => used.add(s.id));
  const readAll = mostRead(30);
  const read = { byViews: readAll.byViews, stories: readAll.stories.filter((s) => !used.has(s.id)).slice(0, 6) };

  return (
    <main>
      <LiveUpdater since={Date.now()} />
      <Ticker items={breaking.map((s) => ({ href: s.href, title: s.title, ts: s.published }))} />

      <div className="mx-auto max-w-[1320px] px-4 sm:px-8">
        {/* 1. Subiectul principal */}
        <section aria-label="Subiectul principal" className="mt-8 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            {listImage(lead) && (
              <Link href={lead.href} tabIndex={-1} aria-hidden className="block">
                <Figure img={listImage(lead)!} ratio="3/2" priority sizes="(max-width: 1024px) 100vw, 720px" credit="overlay" />
              </Link>
            )}
          </div>
          <div className="lg:col-span-5 lg:border-l lg:border-rule lg:pl-6">
            <div className="mb-4 h-[3px] w-14 bg-accent" />
            <article className="group relative">
              <Kicker story={lead} className="mb-2" />
              <h2 className={`hl ${leadClass(lead.title)}`}>
                <Link href={lead.href} className="stretched">
                  {lead.title}
                </Link>
              </h2>
              {lead.dek && <p className="dek mt-4 text-[19px] sm:text-[20px]">{lead.dek}</p>}
              <Meta story={lead} reading className="mt-4" />
            </article>
            {related.length > 0 && (
              <ul className="mt-5 border-t border-rule-strong pt-1">
                {related.map((s) => (
                  <StoryLink key={s.id} story={s} />
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 2. Secundare */}
        {secondary.length > 0 && (
          <section aria-label="Alte subiecte importante" className="col-rules mt-8 grid gap-x-10 gap-y-6 border-t border-rule pt-6 sm:grid-cols-2 lg:grid-cols-4">
            {secondary.map((s, i) => (
              <div key={s.id} className="col-rule border-b border-rule pb-6 sm:border-b-0">
                <StoryBlock story={s} size="md" ratio="3/2" sizes="(max-width: 640px) 100vw, 290px" className={i > 0 ? "hidden sm:block" : undefined} />
                {i > 0 && <StoryRow story={s} thumb className="sm:hidden" />}
              </div>
            ))}
          </section>
        )}

        {/* 3. Politică + Național */}
        {(politica.length > 0 || national.length > 0) && (
          <section className="mt-16 grid gap-10 lg:grid-cols-2">
            {[
              { title: "Politică", href: "/categorie/politica", list: politica },
              { title: "Național", href: "/categorie/national", list: national },
            ]
              .filter((x) => x.list.length)
              .map(({ title, href, list }) => (
                <div key={href}>
                  <SectionHead title={title} href={href} size="md" />
                  <StoryBlock story={list[0]} size="lg" ratio="3/2" dek sizes="(max-width: 1024px) 100vw, 600px" />
                  <div className="mt-5 border-t border-rule">
                    {list.slice(1, 5).map((s) => (
                      <StoryRow key={s.id} story={s} kicker={false} thumb className="border-b border-rule py-3 last:border-0" />
                    ))}
                  </div>
                </div>
              ))}
          </section>
        )}

        {/* 4. Flux live + cele mai relatate (fără repetări) */}
        <section className="mt-14 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <SectionHead title="Pe scurt" href="/pe-scurt" size="md" />
            <ol className="relative">
              {latest.slice(0, 8).map((s) => (
                <li key={s.id} className="group relative grid grid-cols-[64px_1fr] gap-4 border-b border-rule py-3 last:border-0">
                  <Clock ts={s.published} className="mono pt-0.5 text-[13px] text-ink-3" />
                  <div>
                    <Kicker story={s} className="mb-1" />
                    <h3 className="hl hl-sm">
                      <Link href={s.href} className="stretched">
                        {s.title}
                      </Link>
                    </h3>
                    <div className="meta mt-1">{sourcesLabel(s)}</div>
                  </div>
                </li>
              ))}
            </ol>
            <Link href="/pe-scurt" className="ui mt-3 inline-block text-[14px] font-semibold underline underline-offset-4">
              Tot fluxul →
            </Link>
          </div>
          <aside className="lg:col-span-4">
            <SectionHead title={read.byViews ? "Cele mai citite" : "Cele mai relatate"} size="md" />
            <ol>
              {read.stories.map((s, i) => (
                <li key={s.id} className="group relative flex gap-4 border-b border-rule py-3 last:border-0">
                  <span className="section-head w-7 shrink-0 text-[30px] leading-none text-ink-3/60">{i + 1}</span>
                  <div className="min-w-0">
                    <h3 className="hl hl-sm">
                      <Link href={s.href} className="stretched">
                        {s.title}
                      </Link>
                    </h3>
                    <div className="meta mt-1">{read.byViews ? sourcesLabel(s) : `${s.sourceCount} ${s.sourceCount === 1 ? "sursă" : "surse"}`}</div>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </section>

        {/* 5. Internațional */}
        {intl.length > 0 && (
          <section className="mt-16">
            <SectionHead
              title="Internațional"
              href="/categorie/international"
              links={REGIONS.filter((r) => r.slug !== "lume").map((r) => ({ href: `/categorie/international?regiune=${r.slug}`, label: r.label }))}
            />
            <div className="grid gap-6 lg:grid-cols-12">
              <StoryBlock story={intl[0]} size="lg" ratio="3/2" dek priority={false} sizes="(max-width: 1024px) 100vw, 720px" className="lg:col-span-7" />
              <div className="lg:col-span-5 lg:border-l lg:border-rule lg:pl-6">
                {intl.slice(1, 6).map((s) => (
                  <StoryRow key={s.id} story={s} thumb className="border-b border-rule py-3 first:pt-0 last:border-0" />
                ))}
              </div>
            </div>
            {intl.length > 6 && (
              <div className="mt-6 grid gap-6 border-t border-rule pt-5 sm:grid-cols-2 lg:grid-cols-4">
                {intl.slice(6, 10).map((s) => (
                  <article key={s.id} className="group relative flex gap-3">
                    {listImage(s) && <Figure img={listImage(s)!} ratio="1/1" sizes="80px" className="w-20 shrink-0" />}
                    <div className="min-w-0">
                      <div className="kicker mb-1 text-ink-2">{s.region ? REGION_MAP[s.region]?.label : "Extern"}</div>
                      <h3 className="hl hl-sm line-clamp-3">
                        <Link href={s.href} className="stretched">
                          {s.title}
                        </Link>
                      </h3>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 6. Economie + cursul BNR (bandă compactă) */}
        {economie.length > 0 && (
          <section className="mt-16">
            <SectionHead title="Economie" href="/categorie/economie" />
            {rates && <Markets rates={rates} />}
            <div className="grid gap-6 lg:grid-cols-12">
              {economie[0] && (
                <StoryBlock story={economie[0]} size="lg" ratio="3/2" dek className="lg:col-span-5" sizes="(max-width: 1024px) 100vw, 520px" />
              )}
              <div className="grid content-start gap-x-6 sm:grid-cols-2 lg:col-span-7 lg:border-l lg:border-rule lg:pl-6">
                {economie.slice(1, 5).map((s) => (
                  <StoryRow key={s.id} story={s} kicker={false} thumb className="border-b border-rule py-3" />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 7. Sport */}
        {sport.length > 0 && (
          <section className="mt-16">
            <SectionHead title="Sport" href="/categorie/sport" />
            <div className="grid gap-6 lg:grid-cols-12">
              <StoryBlock story={sport[0]} size="lg" ratio="3/2" sizes="(max-width: 1024px) 100vw, 410px" className="lg:col-span-4" />
              <div className="grid gap-x-6 sm:grid-cols-2 lg:col-span-8 lg:border-l lg:border-rule lg:pl-6">
                {sport.slice(1, 7).map((s) => (
                  <StoryRow key={s.id} story={s} kicker={false} thumb className="border-b border-rule py-3" />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 8. Tech | Sănătate | Auto */}
        {[tech, sanatate, auto].some((l) => l.length) && (
          <section className="col-rules mt-16 grid gap-10 md:grid-cols-3 md:gap-12">
            {[
              { title: "Tech & Știință", href: "/categorie/tech", list: tech },
              { title: "Sănătate", href: "/categorie/sanatate", list: sanatate },
              { title: "Auto", href: "/categorie/auto", list: auto },
            ]
              .filter((x) => x.list.length)
              .map(({ title, href, list }) => (
                <div key={href} className="col-rule">
                  <SectionHead title={title} href={href} size="md" />
                  <StoryBlock story={list[0]} size="md" ratio="3/2" sizes="(max-width: 768px) 100vw, 400px" />
                  <div className="mt-4 border-t border-rule">
                    {list.slice(1, 5).map((s) => (
                      <StoryRow key={s.id} story={s} kicker={false} className="border-b border-rule py-3 last:border-0" />
                    ))}
                  </div>
                </div>
              ))}
          </section>
        )}
      </div>

      {/* 9. Cultură + Lifestyle: bandă „revistă” */}
      {(cultura.length > 0 || lifestyle.length > 0) && <Magazine stories={[...cultura, ...lifestyle]} />}

      <div className="mx-auto max-w-[1320px] px-4 sm:px-8">
        {/* 10. Monden */}
        {monden.length > 0 && (
          <section className="mt-16">
            <SectionHead title="Monden" href="/categorie/monden" size="md" />
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4 lg:gap-x-8">
              {monden.map((s) => (
                <article key={s.id} className="group relative">
                  {listImage(s) && <Figure img={listImage(s)!} ratio="3/2" sizes="(max-width: 1024px) 50vw, 300px" className="mb-3" />}
                  <h3 className="hl line-clamp-4 text-[16px] leading-snug sm:text-[18px]">
                    <Link href={s.href} className="stretched">
                      {s.title}
                    </Link>
                  </h3>
                  <Meta story={s} className="mt-1.5" />
                </article>
              ))}
            </div>
          </section>
        )}

        {/* 11. Vremea, compact */}
        {weather && <Weather cities={weather} />}
      </div>
    </main>
  );
}

function Magazine({ stories }: { stories: StoryCard[] }) {
  // Știrea principală a benzii: cea cu poza cea mai mare (poza stă lângă titlu, nu sub el,
  // ca să nu fie mărită sau acoperită de text pe ecranele mici).
  const withImg = [...stories].filter((s) => listImage(s)).sort((a, b) => (listImage(b)?.maxWidth ?? 0) - (listImage(a)?.maxWidth ?? 0));
  const main = withImg[0] ?? stories[0];
  const rest = stories.filter((s) => s.id !== main.id);
  const img = listImage(main);
  const label = (s: StoryCard) => (s.category === "cultura" ? "Cultură" : "Lifestyle");
  return (
    <section className="mt-16 bg-band text-on-band">
      <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-t-2 border-on-band pt-3">
          <h2 className="section-head text-[30px] sm:text-[44px]">Cultură &amp; Lifestyle</h2>
          <div className="ui flex gap-4 text-[13px] font-semibold opacity-80">
            <Link href="/categorie/cultura">Cultură →</Link>
            <Link href="/categorie/lifestyle">Lifestyle →</Link>
          </div>
        </div>
        <article className="group relative grid gap-6 lg:grid-cols-12">
          {img && (
            <div className="lg:col-span-7">
              <Figure img={img} ratio="3/2" sizes="(max-width: 1024px) 100vw, 720px" credit="overlay" />
            </div>
          )}
          <div className={img ? "lg:col-span-5 lg:self-end" : "lg:col-span-12"}>
            <div className="kicker mb-2 opacity-70">{label(main)}</div>
            <h3 className="hl hl-lg">
              <Link href={main.href} className="stretched">
                {main.title}
              </Link>
            </h3>
            {main.dek && <p className="dek mt-3 text-[17px] opacity-80">{main.dek}</p>}
            <div className="meta mt-3 opacity-70">{sourcesLabel(main)}</div>
          </div>
        </article>
        {rest.length > 0 && (
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {rest.slice(0, 3).map((s) => (
              <article key={s.id} className="group relative border-t border-band-rule pt-3">
                <div className="kicker mb-1 opacity-60">{label(s)}</div>
                <h3 className="hl hl-sm line-clamp-3">
                  <Link href={s.href} className="stretched">
                    {s.title}
                  </Link>
                </h3>
                <div className="meta mt-1 opacity-60">{sourcesLabel(s)}</div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <main className="mx-auto max-w-[1320px] px-4 py-24 sm:px-8">
      <div className="max-w-2xl border-t-2 border-rule-strong pt-4">
        <h1 className="section-head text-[44px]">Redacția se pregătește</h1>
        <p className="dek mt-4 text-[20px]">
          Median colectează primele știri din fluxurile publicațiilor. Primele articole apar în câteva minute după pornirea procesului de
          colectare (<code className="mono not-italic">npm run worker</code>).
        </p>
      </div>
    </main>
  );
}
