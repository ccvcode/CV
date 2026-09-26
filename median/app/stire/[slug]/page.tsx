import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArticleTools, ReadingProgress, ViewBeacon } from "@/components/article-tools";
import { Figure } from "@/components/figure";
import { SectionHead } from "@/components/section";
import { StoryBlock, StoryRow } from "@/components/story";
import { TimeAgo } from "@/components/time";
import { isAdmin } from "@/lib/admin/auth";
import { config } from "@/lib/core/config";
import { CATEGORY_MAP } from "@/lib/core/categories";
import type { ArticleQuote } from "@/lib/core/types";
import { dayLabel, formatDate, formatLongDate, formatTime } from "@/lib/core/utils";
import { distinctStories, getStory, mostRead, type SourceChip } from "@/lib/data/queries";
import { coverageOf } from "@/lib/data/coverage";
import { CoverageMap } from "@/components/coverage";
import { FollowButton } from "@/components/push";

export const dynamic = "force-dynamic";

function parseId(slug: string): string {
  const m = /(s[a-z0-9]{6,12})$/.exec(decodeURIComponent(slug));
  return m ? m[1] : "";
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = getStory(parseId((await params).slug));
  if (!s) return { title: "Articol indisponibil" };
  const title = s.article?.headline ?? s.card.title;
  const description = (s.article?.dek ?? s.card.dek).slice(0, 200);
  const og = s.card.hero ?? s.card.thumb;
  return {
    title,
    description,
    alternates: { canonical: s.card.href },
    openGraph: { title, description, type: "article", images: og ? [{ url: og.src, width: og.width, height: og.height }] : undefined },
    // Știrile scurte (o singură sursă) nu se indexează: nu aduc suficientă valoare proprie.
    robots: s.article?.kind === "full" ? undefined : { index: false, follow: true },
  };
}

export default async function StoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ previzualizare?: string }> }) {
  const { slug } = await params;
  const id = parseId(slug);
  const preview = (await searchParams).previzualizare === "1" && (await isAdmin());
  const s = getStory(id, { preview });
  if (!s) notFound();
  const canonical = s.card.href;
  if (!preview && decodeURIComponent(`/stire/${slug}`) !== canonical) permanentRedirect(canonical);

  const a = s.article;
  const cat = CATEGORY_MAP[s.card.category];
  // Fiecare articol are imagine: poza aleasă automat sau, în lipsa ei, coperta generată.
  const hero = s.card.hero;
  // Pe toată lățimea doar pozele mari și orizontale; portretele stau în coloana textului.
  const wideHero = Boolean(hero && (hero.maxWidth ?? hero.width) >= 1400 && hero.width / Math.max(1, hero.height) >= 1.3);
  const firstReport = [...s.sources].sort((x, y) => x.published - y.published)[0];
  // „Știrea completă” trimite la articolul din care vin titlul și extrasul afișate.
  const mainSource = s.sources.find((x) => x.lead) ?? firstReport;
  const outletCount = new Set(s.sources.map((x) => x.name)).size;
  const lastReport = [...s.sources].sort((x, y) => y.published - x.published)[0];
  // Extrase din alte publicații (câte unul, fiecare sub limita legală), cu titluri diferite între ele.
  const angles = pickAngles(s.sources, mainSource?.url);
  const readOn = [...new Map(s.sources.map((x) => [x.name, x])).values()].slice(0, 6);
  const outlets = [...new Set(s.sources.map((x) => x.name))];
  const updated = a && a.updated - a.published > 5 * 60_000 ? a.updated : undefined;
  const popular = distinctStories(
    mostRead(8).stories.filter((r) => r.id !== s.card.id && !s.related.some((x) => x.id === r.id)),
    [s.card, ...s.related]
  ).slice(0, 5);
  const coverage = coverageOf(s.card.category, outlets, Date.now() - s.card.published);
  const pull: ArticleQuote | undefined = a?.quotes.find((q) => q.text.length > 40 && q.text.length < 260);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: a?.headline ?? s.card.title,
    description: a?.dek ?? s.card.dek,
    datePublished: new Date(a?.published ?? s.card.published).toISOString(),
    dateModified: new Date(a?.updated ?? s.card.updated).toISOString(),
    image: s.card.hero ? [new URL(s.card.hero.src, config.siteUrl).toString()] : undefined,
    author: { "@type": "Organization", name: "Redacția Median", url: `${config.siteUrl}/despre` },
    publisher: { "@type": "Organization", name: "Median", url: config.siteUrl },
    isBasedOn: s.sources.map((x) => x.url),
    articleSection: cat?.label,
    inLanguage: "ro",
    isAccessibleForFree: true,
  };

  return (
    <main className="pb-6" data-story={s.card.id}>
      <ReadingProgress />
      <ViewBeacon id={s.card.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {(s.status !== "active" || preview) && <div className="ui bg-accent px-4 py-2 text-center text-[13px] text-white">Previzualizare: acest subiect nu este public.</div>}

      <article className="mx-auto max-w-[1320px] px-4 sm:px-8">
        <header className="grid pt-8 sm:pt-12 lg:grid-cols-12">
          <div className="lg:col-span-10 lg:col-start-2">
            <div className="flex items-center gap-3">
              <Link href={`/categorie/${s.card.category}`} className="kicker text-ink-2 hover:text-ink">
                {cat?.label}
              </Link>
              {s.card.breaking && <span className="kicker text-accent">Ultima oră</span>}
            </div>
            <h1 className={`hl mt-3 ${(a?.headline ?? s.card.title).length > 90 ? "hl-xl !text-[clamp(30px,3.4vw,46px)]" : "hl-xl sm:!text-[56px]"}`}>{a?.headline ?? s.card.title}</h1>
            {/* Fără articol AI, extrasul sursei apare o singură dată, citat și atribuit, în corpul paginii. */}
            {a?.dek && <p className="dek mt-5 max-w-3xl text-[20px] sm:text-[22px]">{a.dek}</p>}

            {/* Transparență: eticheta AI vizibilă de la prima vedere (AI Act, art. 50) */}
            {a && (
              <p className="ui mt-5 inline-flex flex-wrap items-center gap-x-2 border-l-[3px] border-accent bg-surface px-3 py-1.5 text-[13px] text-ink-2">
                <b className="font-semibold text-ink">{a.kind === "full" ? `Sinteză redactată cu AI din ${outlets.length} surse` : "Știre scurtă redactată cu AI"}</b>
                <span>· verificată automat față de surse ·</span>
                <Link href="/politica-ai" className="underline underline-offset-2 hover:text-ink">
                  cum lucrăm
                </Link>
              </p>
            )}

            <div className="meta mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-rule py-3">
              <span className="font-semibold text-ink">{a ? "Redacția Median" : outletCount === 1 ? "Agregat dintr-o sursă" : `Agregat din ${outletCount} publicații`}</span>
              <span aria-hidden>·</span>
              <span suppressHydrationWarning>
                {formatLongDate(a?.published ?? s.card.published)}, {formatTime(a?.published ?? s.card.published)}
              </span>
              {updated && (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-accent-ink">
                    Actualizat <TimeAgo ts={updated} />
                  </span>
                </>
              )}
              {a?.kind === "full" && (
                <>
                  <span aria-hidden>·</span>
                  <span>{Math.max(1, Math.round(a.wordCount / 220))} min citire</span>
                </>
              )}
            </div>
            {/* Acoperirea subiectului: date proprii Median (cine a relatat și când). */}
            {!a && outletCount > 1 && firstReport && lastReport && (
              <p className="ui mt-3 text-[13px] text-ink-2">
                <b className="text-ink">{outletCount} publicații</b> au relatat · primul raport: {firstReport.name},{" "}
                <span suppressHydrationWarning>{formatDate(firstReport.published)}</span>{" "}
                · ultima relatare <TimeAgo ts={lastReport.published} />
              </p>
            )}
            <div className="mt-4 lg:hidden">
              <ArticleTools item={{ id: s.card.id, href: canonical, title: a?.headline ?? s.card.title, ts: Date.now() }} />
            </div>
          </div>
        </header>

        {/* Poza pe toată lățimea doar dacă are rezoluția necesară; altfel stă în coloana textului. */}
        {hero && wideHero && (
          <div className="mt-8">
            <Figure img={hero} ratio="16/9" priority sizes="(max-width: 1320px) 100vw, 1260px" credit="caption" />
          </div>
        )}

        <div className="mt-8 grid gap-10 lg:grid-cols-12">
          {/* Coloana de distribuire (desktop) */}
          <aside className="hidden lg:col-span-1 lg:block">
            <div className="sticky top-20">
              <ArticleTools item={{ id: s.card.id, href: canonical, title: a?.headline ?? s.card.title, ts: Date.now() }} vertical />
            </div>
          </aside>

          <div className="min-w-0 lg:col-span-7">
            {hero && !wideHero && (
              <div className="mb-8">
                <Figure img={hero} ratio="3/2" priority sizes="(max-width: 1024px) 100vw, 700px" credit="caption" />
              </div>
            )}
            {a && a.keyPoints.length > 0 && (
              <section className="mb-8 border-t-2 border-rule-strong pt-3">
                <h2 className="kicker text-ink-2">Pe scurt</h2>
                <ul className="mt-3 space-y-2.5">
                  {a.keyPoints.map((k, i) => (
                    <li key={i} className="ui flex gap-3 text-[16px] leading-snug">
                      <span aria-hidden className="mt-[7px] inline-block h-[7px] w-[7px] shrink-0 bg-accent" />
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="prose-median">
              {a?.kind === "full" ? (
                a.sections.map((sec, si) => (
                  <section key={si}>
                    {sec.heading && <h2>{sec.heading}</h2>}
                    {sec.paragraphs.map((p, pi) => (
                      <div key={pi}>
                        <p className={si === 0 && pi === 0 ? "dropcap" : undefined}>{p}</p>
                        {pull && si === 0 && pi === 1 && (
                          <blockquote className="my-8 border-t-[3px] border-accent pt-4 lg:-ml-10 lg:w-[calc(100%+2.5rem)]">
                            <p className="hl text-[28px] font-normal italic leading-[1.2] sm:text-[32px]">{pull.text}</p>
                            <footer className="ui mt-3 text-[13px] font-semibold uppercase tracking-wider text-ink-2">{pull.speaker}</footer>
                          </blockquote>
                        )}
                      </div>
                    ))}
                  </section>
                ))
              ) : (
                <>
                  {a?.kind === "brief" && <p className="dropcap">{a.dek}</p>}
                  {!a && (mainSource?.excerpt ?? s.card.dek) && (
                    // Fără redactor AI: un extras scurt (sub limita legală de ~120 de caractere), cu sursa.
                    <blockquote className="border-l-[3px] border-accent pl-4">
                      <p className="!mb-2">„{mainSource?.excerpt ?? s.card.dek}”</p>
                      <footer className="ui text-[13px] font-semibold uppercase tracking-wider text-ink-2">{mainSource?.name}</footer>
                    </blockquote>
                  )}
                  {!a && angles.length > 0 && (
                    <section className="mt-8">
                      <h2 className="kicker !mt-0 text-ink-2">Ce mai spun publicațiile</h2>
                      <ul className="ui mt-3 space-y-4 text-[16px] leading-snug">
                        {angles.map((x) => (
                          <li key={x.url} className="border-t border-rule pt-3">
                            <a href={x.url} target="_blank" rel="noopener" className="font-semibold text-ink no-underline hover:underline">
                              {x.name}: {x.title} ↗
                            </a>
                            <p className="!mb-0 mt-1 text-ink-2">„{x.excerpt}”</p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {mainSource && (
                    <div className="ui mt-8 border-t-2 border-rule-strong pt-3">
                      <div className="kicker text-ink-2">Citește relatarea completă</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(a ? [mainSource] : readOn).map((x) => (
                          <a
                            key={x.name}
                            href={x.url}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center border border-rule-strong px-3 py-1.5 text-[14px] font-semibold text-ink no-underline hover:bg-ink hover:text-on-ink"
                          >
                            {x.name} ↗
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Cine a relatat (și cine nu) */}
            <CoverageMap coverage={coverage} category={s.card.category} links={new Map(s.sources.map((x) => [x.name, x.url]))} />

            {/* Surse */}
            <section className="mt-12 border-t-2 border-rule-strong pt-3" id="surse">
              <h2 className="kicker text-ink-2">
                {a ? "Surse · cronologia subiectului" : outletCount > 1 ? `Cum au relatat ${outletCount} publicații · cronologie` : "Sursa"}
              </h2>
              <p id="nou-subiect" hidden className="ui mt-3 flex items-center gap-2 text-[14px] font-semibold">
                <span aria-hidden className="new-dot" />
                <span>
                  <span data-n /> de la ultima ta vizită (<span data-when />)
                </span>
              </p>
              <Timeline sources={s.sources} heroKey={hero?.smallSrc} />
              <p className="ui mt-6 text-[12px] leading-relaxed text-ink-3">
                {a
                  ? `Articol redactat cu ajutorul inteligenței artificiale pe baza informațiilor publicate de ${outlets.join(", ")}. Faptele aparțin surselor citate; formularea este a redacției Median.`
                  : "Median grupează relatările publicațiilor și trimite la textele lor complete."}{" "}
                Ai observat o eroare?{" "}
                <Link href={`/corecturi?stire=${s.card.id}`} className="font-semibold underline underline-offset-2">
                  Semnalează o corectură
                </Link>
                . Deții drepturi asupra unui material preluat? <Link href="/contact" className="underline underline-offset-2">Scrie-ne</Link>.
              </p>
              {s.corrections.length > 0 && (
                <div className="ui mt-4 border-l-[3px] border-accent pl-3 text-[14px]">
                  {s.corrections.map((c, i) => (
                    <p key={i}>
                      <b>Corecție ({formatDate(c.created_at)}):</b> {c.text}
                    </p>
                  ))}
                </div>
              )}
            </section>

          </div>

          {/* Marginea: context și „De ce contează” */}
          <aside className="lg:col-span-4 lg:border-l lg:border-rule lg:pl-6">
            {a?.why && (
              <section className="mb-8">
                <h2 className="kicker text-ink-2">De ce contează</h2>
                <p className="mt-2 text-[17px] leading-relaxed">{a.why}</p>
              </section>
            )}
            {a?.context && (
              <section className="mb-8">
                <h2 className="kicker text-ink-2">Context</h2>
                <p className="mt-2 text-[17px] leading-relaxed text-ink-2">{a.context}</p>
              </section>
            )}
            {!a && s.topics.length > 0 && (
              <section className="mb-8">
                <h2 className="kicker text-ink-2">Persoane și locuri</h2>
                <div className="ui mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[14px]">
                  {s.topics.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5">
                      <Link href={`/cauta?q=${encodeURIComponent(t)}`} className="underline decoration-rule underline-offset-4 hover:decoration-ink">
                        {t}
                      </Link>
                      <FollowButton name={t} />
                    </span>
                  ))}
                </div>
              </section>
            )}
            {a && a.tags.length > 0 && (
              <section className="mb-8">
                <h2 className="kicker text-ink-2">Subiecte</h2>
                <div className="ui mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[14px]">
                  {a.tags.map((t) => (
                    <Link key={t} href={`/cauta?q=${encodeURIComponent(t)}`} className="underline decoration-rule underline-offset-4 hover:decoration-ink">
                      {t}
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {s.related.length > 0 && (
              <section className="mb-8">
                <h2 className="kicker text-ink-2">Legate de acest subiect</h2>
                <div className="mt-2">
                  {s.related.map((r) => (
                    <StoryRow key={r.id} story={r} kicker={false} className="border-b border-rule py-3 last:border-0" />
                  ))}
                </div>
              </section>
            )}
            {popular.length > 0 && (
              // Marginea nu rămâne goală: cele mai citite subiecte ale zilei, numerotate.
              <section className="hidden lg:sticky lg:top-20 lg:block">
                <h2 className="kicker text-ink-2">Cele mai citite</h2>
                <ol className="mt-2">
                  {popular.map((r, i) => (
                    <li key={r.id} className="flex gap-3 border-b border-rule py-3 last:border-0">
                      <span className="hl w-6 shrink-0 text-[24px] leading-none text-accent">{i + 1}</span>
                      <StoryRow story={r} kicker={false} className="min-w-0 flex-1" />
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </aside>
        </div>
      </article>

      {s.moreInCategory.length > 0 && (
        <section className="mx-auto mt-16 max-w-[1320px] px-4 sm:px-8">
          <SectionHead title={`Mai multe din ${cat?.label ?? ""}`} href={`/categorie/${s.card.category}`} size="md" />
          <div className="col-rules grid gap-10 md:grid-cols-3 md:gap-12">
            {s.moreInCategory.map((r) => (
              <StoryBlock key={r.id} story={r} ratio="3/2" size="md" sizes="(max-width: 768px) 100vw, 400px" className="col-rule" />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

/**
 * Cronologia subiectului, grupată pe publicații: o publicație = un rând (primul ei titlu), restul
 * titlurilor ei sub „+N actualizări”. Primele 8 publicații sunt vizibile, celelalte se deschid la cerere.
 * Miniaturile apar doar când poza diferă de cele de deasupra (nu de 20 de ori același portret).
 */
function Timeline({ sources, heroKey }: { sources: SourceChip[]; heroKey?: string }) {
  const byOutlet = new Map<string, SourceChip[]>();
  for (const x of [...sources].sort((a, b) => a.published - b.published)) byOutlet.set(x.name, [...(byOutlet.get(x.name) ?? []), x]);
  const groups = [...byOutlet.values()];
  // Poza principală a paginii nu se mai repetă ca miniatură.
  const shownThumbs = new Set<string>(heroKey ? [heroKey] : []);
  const row = (list: SourceChip[], i: number) => {
    const [first, ...more] = list;
    const thumbKey = first.thumb?.smallSrc ?? first.thumb?.src ?? "";
    const showThumb = Boolean(first.thumb && i < 8 && !shownThumbs.has(thumbKey));
    if (showThumb) shownThumbs.add(thumbKey);
    return (
      <li key={first.url} data-ts-item={Math.max(first.published, ...more.map((m) => m.published))} className="flex gap-4 border-b border-rule py-3 last:border-0">
        <span className="ui w-14 shrink-0 pt-0.5 text-[12px] leading-tight text-ink-3" suppressHydrationWarning>
          {!first.timeUncertain && <b className="block text-[13px] font-semibold text-ink-2">{formatTime(first.published)}</b>}
          {dayLabel(first.published)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="ui text-[14px] font-semibold">
            <span className="tl-name">{first.name}</span>
            {i === 0 && groups.length > 1 && <span className="kicker ml-2 text-accent">Primul raport</span>}
          </div>
          <a href={first.url} target="_blank" rel="noopener" className="mt-0.5 block text-[16px] leading-snug hover:underline">
            {first.title} <span className="ui text-ink-3">↗</span>
          </a>
          {more.length > 0 && (
            <details className="ui mt-1 text-[13px]">
              <summary className="cursor-pointer text-ink-2">+{more.length} {more.length === 1 ? "actualizare" : "actualizări"}</summary>
              <ul className="mt-1 space-y-1 border-l border-rule pl-3">
                {more.map((m) => (
                  <li key={m.url}>
                    <a href={m.url} target="_blank" rel="noopener" className="hover:underline">
                      {m.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        {showThumb && first.thumb && (
          <a href={first.url} target="_blank" rel="noopener" className="hidden w-20 shrink-0 sm:block" title={first.thumb.credit}>
            <Figure img={first.thumb} ratio="1/1" sizes="80px" />
          </a>
        )}
      </li>
    );
  };
  return (
    <>
      <ol className="mt-3">{groups.slice(0, 8).map(row)}</ol>
      {groups.length > 8 && (
        <details className="mt-2">
          <summary className="ui cursor-pointer text-[14px] font-semibold">Toate cele {groups.length} publicații</summary>
          <ol>{groups.slice(8).map((g, i) => row(g, i + 8))}</ol>
        </details>
      )}
    </>
  );
}

/** Până la 4 extrase de la alte publicații decât sursa principală, cu titluri diferite între ele. */
function pickAngles(sources: SourceChip[], exceptUrl?: string): SourceChip[] {
  const out: SourceChip[] = [];
  const words = (t: string) => new Set(t.toLowerCase().split(/[^a-zăâîșțş0-9]+/u).filter((w) => w.length > 3));
  for (const x of sources) {
    if (!x.excerpt || x.url === exceptUrl || out.some((o) => o.name === x.name)) continue;
    const w = words(x.title);
    const similar = out.some((o) => {
      const ow = words(o.title);
      const inter = [...w].filter((k) => ow.has(k)).length;
      return inter / Math.max(1, Math.min(w.size, ow.size)) > 0.5;
    });
    if (!similar) out.push(x);
    if (out.length >= 4) break;
  }
  return out;
}
