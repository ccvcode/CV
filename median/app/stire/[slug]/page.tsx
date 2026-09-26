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
import { formatDate, formatLongDate, formatTime } from "@/lib/core/utils";
import { getStory } from "@/lib/data/queries";

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
  const wideHero = Boolean(hero && (hero.maxWidth ?? hero.width) >= 1400);
  const firstReport = [...s.sources].sort((x, y) => x.published - y.published)[0];
  // „Știrea completă” trimite la articolul din care vin titlul și extrasul afișate.
  const mainSource = s.sources.find((x) => x.lead) ?? firstReport;
  const outletCount = new Set(s.sources.map((x) => x.name)).size;
  const outlets = [...new Set(s.sources.map((x) => x.name))];
  const updated = a && a.updated - a.published > 5 * 60_000 ? a.updated : undefined;
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
    <main className="pb-6">
      <ReadingProgress />
      <ViewBeacon id={s.card.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {(s.status !== "active" || preview) && <div className="ui bg-accent px-4 py-2 text-center text-[13px] text-white">Previzualizare: acest subiect nu este public.</div>}

      <article className="mx-auto max-w-[1320px] px-4 sm:px-8">
        <header className="grid pt-8 sm:pt-12 lg:grid-cols-12">
          <div className="lg:col-span-9">
            <div className="flex items-center gap-3">
              <Link href={`/categorie/${s.card.category}`} className="kicker text-ink-2 hover:text-ink">
                {cat?.label}
              </Link>
              {s.card.breaking && <span className="kicker text-accent">Ultima oră</span>}
            </div>
            <h1 className={`hl mt-3 ${(a?.headline ?? s.card.title).length > 90 ? "hl-xl !text-[clamp(30px,3.4vw,46px)]" : "hl-xl sm:!text-[56px]"}`}>{a?.headline ?? s.card.title}</h1>
            {(a?.dek ?? s.card.dek) && <p className="dek mt-5 max-w-3xl text-[20px] sm:text-[22px]">{a?.dek ?? s.card.dek}</p>}

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
                  {!a && s.card.dek && (
                    // Fără redactor AI: un extras scurt (sub limita legală de ~120 de caractere), cu sursa.
                    <blockquote className="border-l-[3px] border-accent pl-4">
                      <p className="!mb-2">„{s.card.dek}”</p>
                      <footer className="ui text-[13px] font-semibold uppercase tracking-wider text-ink-2">{mainSource?.name}</footer>
                    </blockquote>
                  )}
                  {mainSource && (
                    <p className="ui mt-6">
                      <a
                        href={mainSource.url}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-2 bg-ink px-4 py-2.5 text-[15px] font-semibold text-on-ink no-underline hover:bg-accent"
                      >
                        Citește relatarea completă pe {mainSource.name} ↗
                      </a>
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Surse */}
            <section className="mt-12 border-t-2 border-rule-strong pt-3" id="surse">
              <h2 className="kicker text-ink-2">
                {a ? "Surse · cronologia subiectului" : outletCount > 1 ? `Cum au relatat ${outletCount} publicații · cronologie` : "Sursa"}
              </h2>
              <ol className="mt-3">
                {[...s.sources]
                  .sort((x, y) => x.published - y.published)
                  .map((src, i) => (
                    <li key={src.url} className="flex gap-4 border-b border-rule py-3 last:border-0">
                      <span className="mono w-12 shrink-0 pt-0.5 text-[12px] text-ink-3" suppressHydrationWarning>
                        {formatTime(src.published)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="ui text-[14px] font-semibold">
                          {src.name}
                          {i === 0 && s.sources.length > 1 && <span className="kicker ml-2 text-accent">Primul raport</span>}
                        </div>
                        <a href={src.url} target="_blank" rel="noopener" className="dek mt-0.5 block text-[16px] hover:underline">
                          „{src.title}” <span className="ui not-italic text-ink-3">↗</span>
                        </a>
                        <div className="meta mt-0.5" suppressHydrationWarning>
                          {formatDate(src.published)}
                        </div>
                      </div>
                      {src.thumb && (
                        <a href={src.url} target="_blank" rel="noopener" className="w-24 shrink-0" title={src.thumb.credit}>
                          <Figure img={src.thumb} ratio="1/1" sizes="96px" />
                          <span className="mono mt-0.5 block truncate text-[9.5px] text-ink-3">{src.thumb.credit}</span>
                        </a>
                      )}
                    </li>
                  ))}
              </ol>
              <p className="ui mt-4 bg-surface p-4 text-[13px] leading-relaxed text-ink-2">
                {a
                  ? `Acest articol a fost redactat cu ajutorul inteligenței artificiale pe baza informațiilor publicate de ${outlets.join(", ")}. Faptele aparțin surselor citate; formularea este a redacției Median.`
                  : "Median semnalează această știre și trimite la publicațiile care au relatat-o."}{" "}
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

            <div className="mt-8 lg:hidden">
              <ArticleTools item={{ id: s.card.id, href: canonical, title: a?.headline ?? s.card.title, ts: Date.now() }} />
            </div>
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
                    <Link key={t} href={`/cauta?q=${encodeURIComponent(t)}`} className="underline decoration-rule underline-offset-4 hover:decoration-ink">
                      {t}
                    </Link>
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
              <section className="lg:sticky lg:top-20">
                <h2 className="kicker text-ink-2">Legate de acest subiect</h2>
                <div className="mt-2">
                  {s.related.slice(0, 4).map((r) => (
                    <StoryRow key={r.id} story={r} kicker={false} className="border-b border-rule py-3 last:border-0" />
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </article>

      {s.related.length > 4 && (
        <section className="mx-auto mt-16 max-w-[1320px] px-4 sm:px-8">
          <SectionHead title={`Mai multe din ${cat?.label ?? ""}`} href={`/categorie/${s.card.category}`} size="md" />
          <div className="col-rules grid gap-10 md:grid-cols-3 md:gap-12">
            {s.related.slice(4, 7).map((r) => (
              <StoryBlock key={r.id} story={r} ratio="3/2" size="md" sizes="(max-width: 768px) 100vw, 400px" className="col-rule" />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
