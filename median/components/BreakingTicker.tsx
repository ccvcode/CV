import Link from "next/link";
import type { Article } from "@/lib/types";
import { articleHref, formatTime } from "@/lib/utils";

export function BreakingTicker({ articles }: { articles: Article[] }) {
  if (!articles.length) return null;
  const items = [...articles, ...articles];
  return (
    <div className="ticker relative flex items-stretch overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="z-10 flex shrink-0 items-center gap-2 bg-breaking px-3 text-[11px] font-bold uppercase tracking-widest text-white sm:px-4">
        <span className="pulse-dot h-2 w-2 rounded-full bg-white text-white" />
        <span className="hidden sm:inline">Ultima oră</span>
        <span className="sm:hidden">Acum</span>
      </div>
      <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_4%,black_96%,transparent)]">
        <div className="ticker-track flex w-max items-center py-2.5" style={{ ["--ticker-duration" as string]: `${articles.length * 9}s` }}>
          {items.map((a, i) => (
            <Link key={a.id + i} href={articleHref(a)} className="flex shrink-0 items-center gap-2 px-5 text-sm hover:text-brand" aria-hidden={i >= articles.length ? true : undefined} tabIndex={i >= articles.length ? -1 : undefined}>
              <span className="font-semibold tabular-nums text-breaking">{formatTime(a.published)}</span>
              <span className="font-medium">{a.title}</span>
              <span className="text-ink-faint">— {a.sourceName}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
