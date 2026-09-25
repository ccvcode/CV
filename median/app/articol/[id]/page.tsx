import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Clock, Layers } from "lucide-react";
import { ArticleActions } from "@/components/ArticleActions";
import { ArticleImage } from "@/components/ArticleImage";
import { CompactCard, StandardCard } from "@/components/Cards";
import { Favicon } from "@/components/Favicon";
import { CategoryChip } from "@/components/Meta";
import { ReadingProgress } from "@/components/ReadingProgress";
import { SectionHeader } from "@/components/SectionHeader";
import { TimeAgo } from "@/components/TimeAgo";
import { CATEGORY_MAP } from "@/lib/categories";
import { getArticle, getArticles, getCluster } from "@/lib/store";
import { articleHref, formatLongDate, formatTime } from "@/lib/utils";

// Randare la cerere: pe instanțe diferite (serverless) un articol nou poate lipsi din
// memoria locală, iar un 404 salvat în cache-ul ISR ar ascunde articolul 5 minute.
export const dynamic = "force-dynamic";

async function load(param: string) {
  const id = decodeURIComponent(param).split("-")[0];
  return getArticle(id);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const a = await load((await params).id);
  if (!a) return { title: "Articol indisponibil" };
  return {
    title: a.title,
    description: a.summary?.slice(0, 200) || a.title,
    // Articolul original este sursa canonică; Median doar îl semnalează.
    alternates: { canonical: a.link },
    openGraph: { title: a.title, description: a.summary?.slice(0, 200), images: a.image ? [a.image] : undefined, type: "article" },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const a = await load((await params).id);
  if (!a) notFound();
  const cluster = getCluster(a).filter((x) => x.id !== a.id);
  const related = (await getArticles({ category: a.category, limit: 20 })).filter((x) => x.id !== a.id && !cluster.some((c) => c.id === x.id));
  const cat = CATEGORY_MAP[a.category];
  const paragraphs = (a.content || a.summary || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const outlets = new Set(cluster.map((x) => x.sourceName));
  outlets.delete(a.sourceName);

  return (
    <main className="pb-10">
      <ReadingProgress color={cat?.color} />
      <article className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip slug={a.category} />
          {outlets.size > 0 && (
            <a href="#alte-surse" className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand">
              <Layers className="h-3 w-3" /> {outlets.size + 1} surse relatează
            </a>
          )}
        </div>
        <h1 className="headline mt-4 text-3xl font-bold leading-[1.1] sm:text-5xl">{a.title}</h1>
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-line py-4 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold">
            <Favicon name={a.sourceName} site={a.sourceSite} size={24} />
            {a.sourceName}
          </span>
          {a.author && <span className="text-ink-muted">de {a.author}</span>}
          <span className="text-ink-muted" suppressHydrationWarning>
            {formatLongDate(a.published)}, {formatTime(a.published)} · <TimeAgo ts={a.published} />
          </span>
          <span className="inline-flex items-center gap-1 text-ink-muted">
            <Clock className="h-3.5 w-3.5" /> {a.readingTime} min
          </span>
        </div>
      </article>

      {a.image && (
        <div className="mx-auto mt-8 max-w-5xl px-4 sm:px-6">
          <ArticleImage src={a.image} alt={a.title} category={a.category} priority zoom={false} className="aspect-[16/9] w-full rounded-3xl" />
          <p className="mt-2 text-xs text-ink-faint">Foto: {a.sourceName}</p>
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="prose-median mt-8 text-lg text-ink">
          {paragraphs.length ? (
            paragraphs.map((p, i) => (
              <p key={i} className={i === 0 ? "text-xl font-medium leading-relaxed" : "text-ink/90"}>
                {p}
              </p>
            ))
          ) : (
            <p className="text-ink-muted">Sursa nu a oferit un rezumat pentru acest articol.</p>
          )}
        </div>

        <a
          href={a.link}
          target="_blank"
          rel="noopener"
          className="group mt-8 flex items-center justify-between gap-4 rounded-2xl p-5 text-white shadow-lg transition hover:-translate-y-0.5"
          style={{ background: `linear-gradient(135deg, ${cat?.color ?? "#3A2BFF"}, #3A2BFF)` }}
        >
          <span>
            <span className="block text-xs font-semibold uppercase tracking-widest text-white/75">Articolul complet</span>
            <span className="text-lg font-semibold">Citește pe {a.sourceName}</span>
          </span>
          <ArrowUpRight className="h-7 w-7 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>

        <div className="mt-6">
          <ArticleActions
            article={{
              id: a.id,
              slug: a.slug,
              title: a.title,
              summary: a.summary,
              image: a.image,
              sourceName: a.sourceName,
              sourceSite: a.sourceSite,
              category: a.category,
              published: a.published,
              link: a.link,
              readingTime: a.readingTime,
            }}
          />
        </div>

        {cluster.length > 0 && (
          <section id="alte-surse" className="mt-14 scroll-mt-32">
            <SectionHeader title="Cum relatează alte surse" kicker={`${outlets.size + 1} publicații despre acest subiect`} color="var(--brand)" />
            <ol className="relative space-y-3 border-l-2 border-line pl-6">
              {[a, ...cluster]
                .sort((x, y) => x.published - y.published)
                .map((x, i) => (
                  <li key={x.id} className="relative">
                    <span className={`absolute -left-[31px] top-4 h-3 w-3 rounded-full ring-4 ring-bg ${x.id === a.id ? "bg-brand" : "bg-line"}`} />
                    <Link href={articleHref(x)} className={`block rounded-2xl border p-4 transition hover:border-ink-faint ${x.id === a.id ? "border-brand bg-brand-soft/40" : "border-line bg-surface"}`}>
                      <div className="flex items-center gap-2 text-xs text-ink-muted">
                        <Favicon name={x.sourceName} site={x.sourceSite} size={16} />
                        <b className="text-ink">{x.sourceName}</b> · {formatTime(x.published)}
                        {i === 0 && <span className="rounded-full bg-live/15 px-2 py-0.5 font-semibold text-live">Primul raport</span>}
                      </div>
                      <div className="mt-1.5 font-semibold leading-snug">{x.title}</div>
                    </Link>
                  </li>
                ))}
            </ol>
          </section>
        )}
      </div>

      {related.length > 0 && (
        <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
          <SectionHeader title={`Mai multe din ${cat?.label ?? "categorie"}`} href={`/categorie/${a.category}`} color={cat?.color} />
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {related.slice(0, 4).map((r) => (
              <StandardCard key={r.id} article={r} />
            ))}
          </div>
          <div className="mt-8 grid gap-x-8 divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
            {related.slice(4, 10).map((r) => (
              <div key={r.id} className="border-line sm:border-b">
                <CompactCard article={r} showCategory={false} />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
