import Link from "next/link";
import { CATEGORY_MAP } from "@/lib/categories";
import type { Article, CategorySlug } from "@/lib/types";
import { cx } from "@/lib/utils";
import { Favicon } from "./Favicon";
import { TimeAgo } from "./TimeAgo";

export function CategoryChip({ slug, className, solid }: { slug: CategorySlug; className?: string; solid?: boolean }) {
  const c = CATEGORY_MAP[slug];
  if (!c) return null;
  return (
    <Link
      href={`/categorie/${c.slug}`}
      className={cx(
        "relative z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors",
        className
      )}
      style={solid ? { background: c.color, color: "white" } : { color: c.color, background: `color-mix(in oklab, ${c.color} 12%, transparent)` }}
    >
      {!solid && <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />}
      {c.short}
    </Link>
  );
}

/** Stivă de favicon-uri ale surselor care relatează același subiect. */
export function SourceStack({ articles, max = 4, size = 18 }: { articles: Article[]; max?: number; size?: number }) {
  const unique = [...new Map(articles.map((a) => [a.sourceName, a])).values()];
  return (
    <span className="inline-flex items-center">
      <span className="flex -space-x-1.5">
        {unique.slice(0, max).map((a) => (
          <Favicon key={a.sourceName} name={a.sourceName} site={a.sourceSite} size={size} />
        ))}
      </span>
      {unique.length > max && <span className="ml-1 text-[11px] font-semibold text-ink-muted">+{unique.length - max}</span>}
    </span>
  );
}

export function MetaRow({
  article,
  cluster,
  className,
  light,
  showReading = true,
}: {
  article: Article;
  cluster?: Article[];
  className?: string;
  light?: boolean;
  showReading?: boolean;
}) {
  const sources = cluster ? new Set(cluster.map((a) => a.sourceName)).size : 1;
  return (
    <div className={cx("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", light ? "text-white/80" : "text-ink-muted", className)}>
      {sources > 1 && cluster ? (
        <>
          <SourceStack articles={cluster} />
          <span className={cx("font-semibold", light ? "text-white" : "text-ink")}>{sources} surse</span>
        </>
      ) : (
        <>
          <Favicon name={article.sourceName} site={article.sourceSite} />
          <span className={cx("font-semibold", light ? "text-white" : "text-ink")}>{article.sourceName}</span>
        </>
      )}
      <span aria-hidden>·</span>
      <TimeAgo ts={article.published} />
      {showReading && (
        <>
          <span aria-hidden className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">{article.readingTime} min</span>
        </>
      )}
    </div>
  );
}
