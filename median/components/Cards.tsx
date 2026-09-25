import Link from "next/link";
import type { Article, Cluster } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/categories";
import { articleHref, cx } from "@/lib/utils";
import { ArticleImage } from "./ArticleImage";
import { CategoryChip, MetaRow, SourceStack } from "./Meta";
import { TimeAgo } from "./TimeAgo";
import { Favicon } from "./Favicon";

/** Link „întins” peste tot cardul — evită link-urile imbricate. */
function CardLink({ article, children, className }: { article: Article; children: React.ReactNode; className?: string }) {
  return (
    <Link href={articleHref(article)} className={cx("after:absolute after:inset-0 after:content-['']", className)}>
      {children}
    </Link>
  );
}

export function LeadCard({ cluster, priority }: { cluster: Cluster; priority?: boolean }) {
  const a = cluster.lead;
  const others = cluster.articles.filter((x) => x.sourceName !== a.sourceName).slice(0, 3);
  return (
    <article className="group relative isolate flex h-full min-h-[440px] flex-col justify-end overflow-hidden rounded-3xl bg-ink text-white shadow-sm lg:min-h-[560px]">
      <ArticleImage src={a.image} alt={a.title} category={a.category} priority={priority} className="absolute inset-0 -z-10 h-full w-full" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-black/5" />
      <div className="p-5 sm:p-8">
        <div className="mb-4 flex items-center gap-2">
          <CategoryChip slug={a.category} solid />
          {cluster.sources.length > 2 && (
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur">Subiectul zilei</span>
          )}
        </div>
        <h2 className="headline max-w-3xl text-3xl font-semibold leading-[1.08] sm:text-4xl lg:text-5xl">
          <CardLink article={a}>
            <span className="link-underline">{a.title}</span>
          </CardLink>
        </h2>
        {a.summary && <p className="mt-4 line-clamp-2 max-w-2xl text-[15px] leading-relaxed text-white/80 sm:text-base">{a.summary}</p>}
        {others.length > 0 && (
          <ul className="relative z-10 mt-5 hidden max-w-2xl space-y-1.5 border-l-2 border-white/25 pl-4 md:block">
            {others.map((o) => (
              <li key={o.id} className="flex items-center gap-2 text-sm text-white/85">
                <Favicon name={o.sourceName} site={o.sourceSite} size={14} />
                <Link href={articleHref(o)} className="line-clamp-1 hover:underline">
                  <span className="font-semibold text-white">{o.sourceName}:</span> {o.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <MetaRow article={a} cluster={cluster.articles} light className="mt-5" />
      </div>
    </article>
  );
}

export function StandardCard({ cluster, article, priority, className }: { cluster?: Cluster; article?: Article; priority?: boolean; className?: string }) {
  const a = cluster?.lead ?? article!;
  return (
    <article className={cx("group relative flex flex-col", className)}>
      <div className="relative overflow-hidden rounded-2xl">
        <ArticleImage src={a.image} alt={a.title} category={a.category} priority={priority} className="aspect-[3/2] w-full" />
        {cluster && cluster.sources.length > 1 && (
          <span className="glass absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold text-ink">
            <SourceStack articles={cluster.articles} max={3} size={16} />
            {cluster.sources.length} surse
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <CategoryChip slug={a.category} />
      </div>
      <h3 className="headline mt-2 line-clamp-3 text-xl font-semibold leading-snug">
        <CardLink article={a}>
          <span className="link-underline">{a.title}</span>
        </CardLink>
      </h3>
      {a.summary && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">{a.summary}</p>}
      <MetaRow article={a} cluster={cluster && cluster.sources.length > 1 ? cluster.articles : undefined} className="mt-3" />
    </article>
  );
}

export function CompactCard({ article, cluster, showCategory = true }: { article?: Article; cluster?: Cluster; showCategory?: boolean }) {
  const a = cluster?.lead ?? article!;
  const color = CATEGORY_MAP[a.category]?.color;
  return (
    <article className="group relative flex gap-4 py-4">
      <div className="min-w-0 flex-1">
        {showCategory && (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>
            {CATEGORY_MAP[a.category]?.short}
          </div>
        )}
        <h3 className="headline line-clamp-3 text-[17px] font-semibold leading-snug">
          <CardLink article={a}>
            <span className="link-underline">{a.title}</span>
          </CardLink>
        </h3>
        <MetaRow article={a} cluster={cluster && cluster.sources.length > 1 ? cluster.articles : undefined} showReading={false} className="mt-2" />
      </div>
      <ArticleImage src={a.image} alt="" category={a.category} className="h-[84px] w-[84px] shrink-0 rounded-xl sm:h-24 sm:w-28" />
    </article>
  );
}

export function TimelineItem({ article, isNew }: { article: Article; isNew?: boolean }) {
  const c = CATEGORY_MAP[article.category];
  return (
    <li className={cx("group relative grid grid-cols-[52px_1fr] gap-3 pb-6", isNew && "fade-up")}>
      <div className="pt-0.5 text-right text-xs font-semibold tabular-nums text-ink-muted">
        {new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }).format(article.published)}
      </div>
      <div className="relative border-l border-line pl-5">
        <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-bg" style={{ background: c?.color }} />
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: c?.color }}>
          {c?.short}
          <span className="font-normal normal-case tracking-normal text-ink-faint">· {article.sourceName}</span>
        </div>
        <h3 className="mt-1 text-[15px] font-semibold leading-snug">
          <CardLink article={article}>
            <span className="link-underline">{article.title}</span>
          </CardLink>
        </h3>
      </div>
    </li>
  );
}

export function NumberedItem({ article, n }: { article: Article; n: number }) {
  return (
    <li className="group relative flex items-start gap-4 border-b border-line py-4 last:border-0">
      <span className="numeral w-10 shrink-0 text-5xl leading-none">{n}</span>
      <div className="min-w-0">
        <h3 className="headline line-clamp-3 text-base font-semibold leading-snug">
          <CardLink article={article}>
            <span className="link-underline">{article.title}</span>
          </CardLink>
        </h3>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-muted">
          <Favicon name={article.sourceName} site={article.sourceSite} size={14} />
          {article.sourceName} · <TimeAgo ts={article.published} />
        </div>
      </div>
    </li>
  );
}

export function OverlayCard({ article, className }: { article: Article; className?: string }) {
  return (
    <article className={cx("group relative isolate flex flex-col justify-end overflow-hidden rounded-2xl bg-ink text-white", className)}>
      <ArticleImage src={article.image} alt={article.title} category={article.category} className="absolute inset-0 -z-10 h-full w-full" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      <div className="p-4 sm:p-5">
        <CategoryChip slug={article.category} solid />
        <h3 className="headline mt-2.5 line-clamp-3 text-lg font-semibold leading-snug sm:text-xl">
          <CardLink article={article}>
            <span className="link-underline">{article.title}</span>
          </CardLink>
        </h3>
        <div className="mt-2 text-xs text-white/75">
          {article.sourceName} · <TimeAgo ts={article.published} />
        </div>
      </div>
    </article>
  );
}
