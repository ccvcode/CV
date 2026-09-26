import Link from "next/link";
import { addCorrection, regenerateStory, setStoryFlag } from "@/lib/admin/actions";
import { db } from "@/lib/core/db";
import { formatDate } from "@/lib/core/utils";
import { storyHref } from "@/lib/data/queries";

function Flag({ storyId, flag, value, label }: { storyId: string; flag: string; value: string; label: string }) {
  return (
    <form action={setStoryFlag}>
      <input type="hidden" name="storyId" value={storyId} />
      <input type="hidden" name="flag" value={flag} />
      <input type="hidden" name="value" value={value} />
      <button className="underline decoration-rule underline-offset-4 hover:decoration-ink">{label}</button>
    </form>
  );
}

export default function Stories() {
  const rows = db()
    .prepare(
      `SELECT s.id, s.slug, s.title, s.category, s.source_count, s.score, s.pinned, s.breaking, s.status, s.last_published_at, a.status AS a_status, a.kind
       FROM stories s LEFT JOIN articles a ON a.id = s.article_id WHERE s.last_published_at > ? ORDER BY s.score DESC LIMIT 120`
    )
    .all(Date.now() - 3 * 86400_000) as {
    id: string;
    slug: string;
    title: string;
    category: string;
    source_count: number;
    score: number;
    pinned: number;
    breaking: number;
    status: string;
    last_published_at: number;
    a_status: string | null;
    kind: string | null;
  }[];
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="kicker border-b border-rule text-left text-ink-3">
          <th className="py-2">Subiect</th>
          <th className="py-2">Surse</th>
          <th className="py-2">Articol</th>
          <th className="py-2">Acțiuni</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className={`border-b border-rule align-top ${r.status !== "active" ? "opacity-50" : ""}`}>
            <td className="max-w-md py-2 pr-4">
              <Link href={storyHref(r)} className="font-serif text-[15px] font-semibold hover:underline">
                {r.title}
              </Link>
              <div className="meta">
                {r.category} · {formatDate(r.last_published_at)} · scor {r.score.toFixed(2)}
                {r.pinned ? " · fixat" : ""}
                {r.breaking ? " · ultima oră" : ""}
              </div>
              <form action={addCorrection} className="mt-1 flex gap-2">
                <input type="hidden" name="storyId" value={r.id} />
                <input name="text" placeholder="Adaugă o corectură publică…" className="min-w-0 flex-1 border border-rule bg-paper px-2 py-1" />
                <button className="font-semibold">Publică</button>
              </form>
            </td>
            <td className="mono py-2">{r.source_count}</td>
            <td className="py-2">{r.kind ? `${r.kind} (${r.a_status})` : "—"}</td>
            <td className="space-y-1 py-2">
              <Flag storyId={r.id} flag="pinned" value={r.pinned ? "0" : "1"} label={r.pinned ? "Nu mai fixa" : "Fixează sus"} />
              <Flag storyId={r.id} flag="breaking" value={r.breaking ? "0" : "1"} label={r.breaking ? "Scoate „Ultima oră”" : "Marchează „Ultima oră”"} />
              <Flag storyId={r.id} flag="status" value={r.status === "active" ? "hidden" : "active"} label={r.status === "active" ? "Ascunde" : "Arată"} />
              <form action={regenerateStory}>
                <input type="hidden" name="storyId" value={r.id} />
                <button className="underline decoration-rule underline-offset-4">Rescrie articolul</button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
