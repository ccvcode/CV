import Link from "next/link";
import { Figure } from "@/components/figure";
import { LiveUpdater } from "@/components/live-updater";
import { SectionHead } from "@/components/section";
import { Kicker, leadClass, listImage, Meta, StoryBlock, StoryLink, StoryRow, sourcesLabel } from "@/components/story";
import { Clock } from "@/components/time";
import { Ticker } from "@/components/ticker";
import { REGION_MAP, REGIONS } from "@/lib/core/categories";
import type { CategorySlug } from "@/lib/core/types";
import { breakingStories, latestStories, mostRead, siteStatus, topStories, type StoryCard } from "@/lib/data/queries";
import { getRates, getWeather } from "@/lib/data/widgets";

export const dynamic = "force-dynamic";

const withPhoto = (list: StoryCard[]) => list.filter((s) => listImage(s));

export default async function Home() {
  const status = siteStatus();
  const used = new Set<string>();
  const pool = topStories({ limit: 30, hours: 36 });
  if (!pool.length) return <EmptyState />;

  // Știrea principală: cel mai important subiect cu fotografie; apoi 4 secundare.
  // Știrea principală: dintre primele trei ca importanță, prima cu o poză destul de mare pentru locul
  // mare (≥1000px); altfel prima cu poză. Pozele mici ar apărea neclare la 720px.
  const bigPhoto = (s: StoryCard) => (listImage(s)?.maxWidth ?? 0) >= 1000;
  const lead = pool.slice(0, 3).find(bigPhoto) ?? withPhoto(pool)[0] ?? pool[0];
  used.add(lead.id);
  const related = pool.filter((s) => s.id !== lead.id && s.category === lead.category).slice(0, 3);
  related.forEach((s) => used.add(s.id));
  const secondary = [...withPhoto(pool), ...pool].filter((s, i, a) => !used.has(s.id) && a.findIndex((x) => x.id === s.id) === i).slice(0, 4);
  secondary.forEach((s) => used.add(s.id));

  const latest = latestStories({ limit: 10 });
  const read = mostRead(8);
  const breaking = breakingStories(8);
  const [rates, weather] = await Promise.all([getRates().catch(() => null), getWeather().catch(() => null)]);

  const section = (category: CategorySlug, limit: number, hours = 72) => topStories({ category, limit, hours, exclude: used });
  const intl = section("international", 11, 48);
  const politica = section("politica", 5);
  const national = section("national", 5);
  const economie = section("economie", 4);
  const sport = section("sport", 7);
  const tech = section("tech", 5);
  const sanatate = section("sanatate", 5);
  const auto = section("auto", 5);
  const cultura = section("cultura", 4, 120);
  const lifestyle = section("lifestyle", 3, 120);
  const monden = section("monden", 6, 96);

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
              <StoryBlock
                key={s.id}
                story={s}
                size="md"
                ratio="3/2"
                sizes="(max-width: 640px) 100vw, 290px"
                className="col-rule border-b border-rule pb-6 sm:border-b-0"
              />
            ))}
          </section>
        )}

        {/* 3. Flux live + cele mai citite */}
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
                  <span className="section-head w-9 shrink-0 text-[44px] text-ink-3">{i + 1}</span>
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

        {/* 4. Internațional */}
        {intl.length > 0 && (
          <section className="mt-16">
            <SectionHead
              title="Internațional"
              href="/categorie/international"
              links={REGIONS.filter((r) => r.slug !== "lume").map((r) => ({ href: `/categorie/international?regiune=${r.slug}`, label: r.label }))}
            />
            <div className="grid gap-6 lg:grid-cols-12">
              <StoryBlock story={intl[0]} size="lg" ratio="3/2" dek priority={false} sizes="(max-width: 1024px) 100vw, 640px" className="lg:col-span-6" />
              <div className="grid gap-6 sm:grid-cols-2 lg:col-span-6 lg:border-l lg:border-rule lg:pl-6">
                {[intl.slice(1, 4), intl.slice(4, 7)].map((col, ci) => (
                  <div key={ci} className={ci === 1 ? "sm:border-l sm:border-rule sm:pl-6" : ""}>
                    {col.map((s) => (
                      <StoryRow key={s.id} story={s} className="border-b border-rule py-3 first:pt-0 last:border-0" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {intl.length > 7 && (
              <div className="mt-6 grid gap-6 border-t border-rule pt-5 sm:grid-cols-2 lg:grid-cols-4">
                {intl.slice(7, 11).map((s) => (
                  <article key={s.id} className="group relative flex gap-3">
                    {listImage(s) && <Figure img={listImage(s)!} ratio="1/1" sizes="80px" className="w-20 shrink-0" />}
                    <div className="min-w-0">
                      <div className="kicker mb-1 text-ink-2">{s.region ? REGION_MAP[s.region]?.label : "Extern"}</div>
                      <h3 className="hl hl-sm">
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

        {/* 5. Politică + Național */}
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

        {/* 6. Economie + piețe */}
        {(economie.length > 0 || rates) && (
          <section className="mt-16">
            <SectionHead title="Economie" href="/categorie/economie" />
            <div className="grid gap-6 lg:grid-cols-12">
              <div className="grid gap-6 sm:grid-cols-2 lg:col-span-9">
                {economie[0] && <StoryBlock story={economie[0]} size="lg" ratio="3/2" dek className="sm:row-span-3" sizes="(max-width: 640px) 100vw, 480px" />}
                <div className="sm:border-l sm:border-rule sm:pl-6">
                  {economie.slice(1, 4).map((s) => (
                    <StoryRow key={s.id} story={s} kicker={false} className="border-b border-rule py-3 first:pt-0 last:border-0" />
                  ))}
                </div>
              </div>
              {rates && (
                <aside className="bg-surface p-5 lg:col-span-3" id="curs">
                  <div className="kicker text-ink-2">Curs BNR</div>
                  <div className="meta mt-0.5">{new Date(rates.date + "T12:00:00Z").toLocaleDateString("ro-RO", { day: "numeric", month: "long", timeZone: "Europe/Bucharest" })}</div>
                  <table className="mono mt-3 w-full text-[14px]">
                    <tbody>
                      {rates.rates
                        .filter((r) => ["EUR", "USD", "CHF", "GBP", "MDL", "XAU"].includes(r.code))
                        .map((r) => {
                          const diff = r.prev ? r.value - r.prev : 0;
                          return (
                            <tr key={r.code} className="border-b border-rule last:border-0">
                              <td className="py-2 font-semibold">{r.code}</td>
                              <td className="py-2 text-right">{r.value.toFixed(r.value > 100 ? 2 : 4).replace(".", ",")}</td>
                              <td className="w-16 py-2 text-right text-[12px] text-ink-2">{diff === 0 ? "=" : `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff).toFixed(r.value > 100 ? 2 : 4).replace(".", ",")}`}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  <p className="meta mt-3 text-[11px]">Sursa: Banca Națională a României</p>
                </aside>
              )}
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
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
              {monden.map((s) => (
                <article key={s.id} className="group relative">
                  {listImage(s) && <Figure img={listImage(s)!} ratio="1/1" sizes="200px" className="mb-2" />}
                  <h3 className="hl text-[15px] leading-snug">
                    <Link href={s.href} className="stretched">
                      {s.title}
                    </Link>
                  </h3>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* 11. Date utile */}
        {weather && (
          <section className="mt-16 border-t-2 border-rule-strong pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="section-head text-[24px]">Vremea</h2>
              <span className="meta">Open-Meteo · actualizat la 15 minute</span>
            </div>
            <div className="mono mt-3 grid grid-cols-2 gap-x-6 text-[14px] sm:grid-cols-4 lg:grid-cols-7">
              {weather.map((c) => (
                <div key={c.city} className="flex justify-between border-b border-rule py-2">
                  <span className="ui">{c.city}</span>
                  <span>
                    {c.temp}° <span className="text-ink-3">{c.daily[0]?.min}°/{c.daily[0]?.max}°</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
        <p className="meta mt-10">
          Median urmărește {status.outlets} publicații prin {status.sourcesTotal} fluxuri. <Link href="/surse" className="underline underline-offset-4">Vezi sursele</Link>.
        </p>
      </div>
    </main>
  );
}

function Magazine({ stories }: { stories: StoryCard[] }) {
  const [main, ...rest] = [...stories.filter((s) => listImage(s)), ...stories.filter((s) => !listImage(s))];
  const img = listImage(main);
  return (
    <section className="mt-16 bg-ink text-on-ink">
      <div className="mx-auto max-w-[1320px] px-4 py-10 sm:px-8">
        <div className="mb-5 flex items-end justify-between border-t-2 border-on-ink pt-3">
          <h2 className="section-head text-[30px] sm:text-[44px]">Cultură &amp; Lifestyle</h2>
          <div className="ui flex gap-4 text-[13px] font-semibold opacity-80">
            <Link href="/categorie/cultura">Cultură</Link>
            <Link href="/categorie/lifestyle">Lifestyle</Link>
          </div>
        </div>
        <article className="group relative">
          {img ? (
            <div className="relative">
              <Figure img={img} ratio="21/9" sizes="100vw" credit="overlay" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 pt-24 sm:p-8 sm:pt-32">
                <div className="kicker mb-2 text-white/75">{main.category === "cultura" ? "Cultură" : "Lifestyle"}</div>
                <h3 className="hl hl-lg max-w-3xl text-white">
                  <Link href={main.href} className="stretched pointer-events-auto">
                    {main.title}
                  </Link>
                </h3>
              </div>
            </div>
          ) : (
            <h3 className="hl hl-lg">
              <Link href={main.href} className="stretched">
                {main.title}
              </Link>
            </h3>
          )}
        </article>
        {rest.length > 0 && (
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {rest.slice(0, 3).map((s) => (
              <article key={s.id} className="group relative border-t border-white/20 pt-3">
                <div className="kicker mb-1 text-white/60">{s.category === "cultura" ? "Cultură" : "Lifestyle"}</div>
                <h3 className="hl hl-sm">
                  <Link href={s.href} className="stretched">
                    {s.title}
                  </Link>
                </h3>
                <div className="meta mt-1 text-white/55">{sourcesLabel(s)}</div>
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
