/*
 * Evaluează gruparea pe subiecte pe rețeaua demo (unde știm gruparea corectă), simulând
 * algoritmul incremental din pipeline: fiecare articol intră în subiectul cu care se potrivește
 * cel mai bine oricare membru. Rulare: npx tsx scripts/eval/cluster-eval.ts [-v]
 */
import { STORIES } from "../demo-network/content";
import { sameStory, docVector, type DocVector } from "../../lib/pipeline/text";

interface Doc { story: string; outlet: string; title: string; lead: string; t: number; vec: DocVector; cluster?: number }
const docs: Doc[] = STORIES.flatMap((s) => s.versions.map((v) => ({ story: s.id, outlet: v.outlet, title: v.title, lead: v.paragraphs[0], t: -v.offsetMin, vec: docVector(v.title, v.paragraphs[0]) })));
const df = new Map<string, number>();
for (const d of docs) for (const t of Object.keys(d.vec.terms)) df.set(t, (df.get(t) ?? 0) + 1);
const idf = (t: string) => Math.log(1 + docs.length / (df.get(t) ?? 1));

docs.sort((a, b) => a.t - b.t);
let next = 0;
for (let i = 0; i < docs.length; i++) {
  let best: { c: number; score: number } | undefined;
  for (let j = 0; j < i; j++) {
    if (docs[j].outlet === docs[i].outlet) continue;
    const r = sameStory(docs[i].vec, docs[j].vec, idf);
    if (r.same && (!best || r.score > best.score)) best = { c: docs[j].cluster!, score: r.score };
  }
  docs[i].cluster = best ? best.c : next++;
}
let tp = 0, fp = 0, fn = 0;
const out: string[] = [];
for (let i = 0; i < docs.length; i++)
  for (let j = i + 1; j < docs.length; j++) {
    const same = docs[i].story === docs[j].story;
    const pred = docs[i].cluster === docs[j].cluster;
    if (same && pred) tp++;
    else if (pred) { fp++; out.push(`FP: ${docs[i].title} || ${docs[j].title}`); }
    else if (same) { fn++; out.push(`FN: ${docs[i].title} || ${docs[j].title}`); }
  }
console.log(`subiecte reale ${new Set(docs.map((d) => d.story)).size}, grupate ${next} · precizie ${(tp / (tp + fp)).toFixed(3)}, recall ${(tp / (tp + fn)).toFixed(3)} (tp ${tp}, fp ${fp}, fn ${fn})`);
if (process.argv.includes("-v")) console.log(out.join("\n"));
