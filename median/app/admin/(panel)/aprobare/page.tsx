import Link from "next/link";
import { approveArticle, regenerateStory, rejectArticle } from "@/lib/admin/actions";
import { db } from "@/lib/core/db";
import type { ArticleSection } from "@/lib/core/types";
import { formatDate } from "@/lib/core/utils";
import { storyHref } from "@/lib/data/queries";

export default function Review() {
  const rows = db()
    .prepare(
      `SELECT a.id, a.story_id, a.kind, a.headline, a.dek, a.sections, a.review_reason, a.created_at, a.sources, s.slug
       FROM articles a JOIN stories s ON s.id = a.story_id WHERE a.status = 'review' ORDER BY a.created_at DESC LIMIT 50`
    )
    .all() as { id: number; story_id: string; kind: string; headline: string; dek: string; sections: string; review_reason: string | null; created_at: number; sources: string; slug: string }[];
  if (!rows.length) return <p className="dek text-[18px]">Niciun articol nu așteaptă aprobarea.</p>;
  return (
    <ul className="space-y-8">
      {rows.map((r) => {
        const sections = JSON.parse(r.sections) as ArticleSection[];
        const sources = JSON.parse(r.sources) as { sourceName: string; url: string; title: string }[];
        return (
          <li key={r.id} className="border-t-2 border-rule-strong pt-3">
            <div className="meta">
              {formatDate(r.created_at)} · {r.kind === "full" ? "articol complet" : "știre scurtă"} ·{" "}
              <span className="text-accent-ink">{r.review_reason}</span>
            </div>
            <h2 className="hl hl-md mt-1">{r.headline}</h2>
            <p className="dek mt-1 text-[16px]">{r.dek}</p>
            <details className="mt-2 text-[15px]">
              <summary className="cursor-pointer text-[13px] font-semibold">Textul complet și sursele</summary>
              <div className="mt-2 max-w-3xl space-y-2 font-serif">
                {sections.map((s, i) => (
                  <div key={i}>
                    {s.heading && <h3 className="font-sans font-bold">{s.heading}</h3>}
                    {s.paragraphs.map((p, j) => (
                      <p key={j}>{p}</p>
                    ))}
                  </div>
                ))}
              </div>
              <ul className="mt-3 text-[13px]">
                {sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener" className="underline">
                      {s.sourceName}: {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
            <div className="mt-3 flex flex-wrap gap-3 text-[13px] font-semibold">
              <form action={approveArticle}>
                <input type="hidden" name="id" value={r.id} />
                <button className="bg-ink px-4 py-2 uppercase tracking-wider text-on-ink">Aprobă și publică</button>
              </form>
              <form action={rejectArticle}>
                <input type="hidden" name="id" value={r.id} />
                <button className="border border-rule-strong px-4 py-2 uppercase tracking-wider">Respinge</button>
              </form>
              <form action={regenerateStory}>
                <input type="hidden" name="storyId" value={r.story_id} />
                <button className="border border-rule px-4 py-2 uppercase tracking-wider text-ink-2">Regenerează</button>
              </form>
              <Link href={`${storyHref({ id: r.story_id, slug: r.slug })}?previzualizare=1`} className="px-2 py-2 underline">
                Previzualizează
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
