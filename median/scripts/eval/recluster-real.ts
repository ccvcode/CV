/**
 * Regrupează pe subiecte articolele reale dintr-o copie a bazei de date și listează grupurile
 * suspecte (articole fără niciun cuvânt-cheie din titlu comun cu restul grupului).
 * Rulare: MEDIAN_DATA_DIR=/cale/copie npx tsx scripts/eval/recluster-real.ts
 */
import { db } from "../../lib/core/db";
import { clusterPending } from "../../lib/pipeline/ingest";
import { keywords } from "../../lib/pipeline/text";

const d = db();
d.exec("UPDATE items SET story_id = NULL, duplicate_of = NULL; DELETE FROM stories; DELETE FROM jobs;");
const now = (d.prepare("SELECT MAX(fetched_at) AS t FROM items").get() as { t: number }).t;
clusterPending(now);
const stories = d.prepare("SELECT id, title, source_count FROM stories ORDER BY source_count DESC").all() as { id: string; title: string; source_count: number }[];
let suspicious = 0;
const multi = stories.filter((s) => s.source_count >= 2).length;
for (const s of stories) {
  const titles = (d.prepare("SELECT title FROM items WHERE story_id = ?").all(s.id) as { title: string }[]).map((r) => r.title);
  if (titles.length < 2) continue;
  const kw = titles.map((t) => new Set(keywords(t)));
  const odd = titles.filter((_, i) => ![...kw[i]].some((k) => kw.some((o, j) => j !== i && o.has(k))));
  if (odd.length) {
    suspicious += odd.length;
    if (process.env.VERBOSE) console.log(`[${s.source_count}] ${s.title.slice(0, 90)}\n   ≠ ${odd.map((t) => t.slice(0, 90)).join("\n   ≠ ")}`);
  }
}
console.log(`subiecte: ${stories.length}, cu ≥2 surse: ${multi}, cel mai mare: ${stories[0]?.source_count}, articole suspecte: ${suspicious}`);

void (async () => { if (!process.env.DUMP) return;
  const fs = await import("fs");
  const lines: string[] = [];
  for (const s of stories) {
    const titles = (d.prepare("SELECT title FROM items WHERE story_id = ? ORDER BY published_at").all(s.id) as { title: string }[]).map((r) => r.title);
    if (titles.length > 1) lines.push(`# ${s.title}\n` + titles.map((t) => "  " + t).sort().join("\n"));
  }
  fs.writeFileSync(process.env.DUMP, lines.sort().join("\n"));
})();
