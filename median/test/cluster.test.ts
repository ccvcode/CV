/* Calitatea grupării pe subiecte, măsurată pe rețeaua demo (gruparea corectă e cunoscută). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { STORIES } from "../scripts/demo-network/content";
import { docVector, sameStory, type DocVector } from "../lib/pipeline/text";

test("gruparea pe subiecte: precizie ≥ 0,97 și recall ≥ 0,75 pe datele demo", () => {
  type Doc = { story: string; outlet: string; t: number; vec: DocVector; cluster?: number };
  const docs: Doc[] = STORIES.flatMap((s) => s.versions.map((v) => ({ story: s.id, outlet: v.outlet, t: -v.offsetMin, vec: docVector(v.title, v.paragraphs[0]) })));
  const df = new Map<string, number>();
  for (const d of docs) for (const t of Object.keys(d.vec.terms)) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t: string) => Math.log(1 + docs.length / (df.get(t) ?? 1));
  docs.sort((a, b) => a.t - b.t);
  let next = 0;
  docs.forEach((d, i) => {
    let best: { c: number; s: number } | undefined;
    for (let j = 0; j < i; j++) {
      if (docs[j].outlet === d.outlet) continue;
      const r = sameStory(d.vec, docs[j].vec, idf);
      if (r.same && (!best || r.score > best.s)) best = { c: docs[j].cluster!, s: r.score };
    }
    d.cluster = best ? best.c : next++;
  });
  let tp = 0, fp = 0, fn = 0;
  for (let i = 0; i < docs.length; i++)
    for (let j = i + 1; j < docs.length; j++) {
      const same = docs[i].story === docs[j].story;
      const pred = docs[i].cluster === docs[j].cluster;
      if (same && pred) tp++;
      else if (pred) fp++;
      else if (same) fn++;
    }
  assert.ok(tp / (tp + fp) >= 0.97, `precizie ${(tp / (tp + fp)).toFixed(3)}`);
  assert.ok(tp / (tp + fn) >= 0.75, `recall ${(tp / (tp + fn)).toFixed(3)}`);
});
