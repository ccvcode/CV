import type { Article } from "./types";

// Cuvinte fără valoare informativă pentru compararea titlurilor.
const STOP = new Set(
  (
    "si sau dar iar ca ce cu de la in din pe pentru prin despre catre dupa inainte fara sub peste intre spre " +
    "un o unei unui niste cei cele cea cel lui lor ei el ea ele ei este sunt a au fost fi va vor ar mai " +
    "nu da cum cand unde care cine acest aceasta acesti aceste acel acea asta ast azi ieri maine noi nou noua " +
    "foarte doar tot toti toate totul iata video foto live update breaking ultima ora surpriza exclusiv " +
    "the and of to for on with at by from new"
  ).split(" ")
);

function tokens(title: string): Set<string> {
  const norm = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ");
  const out = new Set<string>();
  for (const w of norm.split(/\s+/)) {
    if (w.length < 3 || STOP.has(w)) continue;
    // Stemming rudimentar: primele 6 litere acoperă majoritatea flexiunilor românești.
    out.add(/^\d+$/.test(w) ? w : w.slice(0, 6));
  }
  return out;
}

const WINDOW_MS = 36 * 3600_000;

/**
 * Grupează articolele (sortate descrescător după dată) pe subiecte folosind
 * suprapunerea cuvintelor-cheie din titlu. Setează `clusterId` pe fiecare articol
 * și întoarce un map clusterId -> membri.
 */
export function assignClusters(articles: Article[]): Map<string, Article[]> {
  const n = articles.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const toks = articles.map((a) => tokens(a.title));
  const index = new Map<string, number[]>();

  for (let i = 0; i < n; i++) {
    const a = articles[i];
    const t = toks[i];
    const counts = new Map<number, number>();
    for (const w of t) {
      const list = index.get(w);
      if (!list) continue;
      for (const j of list) counts.set(j, (counts.get(j) ?? 0) + 1);
    }
    for (const [j, shared] of counts) {
      const b = articles[j];
      if (Math.abs(a.published - b.published) > WINDOW_MS) continue;
      if (a.sourceId === b.sourceId) continue;
      const minSize = Math.min(t.size, toks[j].size);
      if (shared >= 3 && shared / minSize >= 0.5) parent[find(i)] = find(j);
    }
    for (const w of t) {
      let list = index.get(w);
      if (!list) index.set(w, (list = []));
      list.push(i);
      // Indexul păstrează doar articolele recente pentru fiecare cuvânt.
      if (list.length > 200) list.shift();
    }
  }

  const groups = new Map<number, Article[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    let g = groups.get(r);
    if (!g) groups.set(r, (g = []));
    g.push(articles[i]);
  }
  const out = new Map<string, Article[]>();
  for (const members of groups.values()) {
    if (members.length < 2) {
      members[0].clusterId = undefined;
      continue;
    }
    const id = "c" + members[members.length - 1].id;
    for (const m of members) m.clusterId = id;
    out.set(id, members);
  }
  return out;
}
