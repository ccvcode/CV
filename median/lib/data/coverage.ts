import { db } from "../core/db";
import type { CategorySlug } from "../core/types";

/*
 * „Unghi mort”: ce publicații au relatat un subiect și care au tăcut. Publicațiile sunt grupate
 * după criterii factuale (tipul redacției), nu după orientare politică. Se compară doar cu
 * publicațiile care acoperă în mod obișnuit tema subiectului și care au publicat în ultimele 24 de
 * ore (un flux căzut nu înseamnă tăcere).
 */

export const GROUPS = {
  tv: "Televiziuni și radio",
  presa: "Ziare și reviste",
  online: "Publicații online",
  agentie: "Agenții de presă",
  international: "Redacții internaționale în limba română",
  moldova: "Presa din R. Moldova",
} as const;
export type GroupKey = keyof typeof GROUPS;
const ORDER: GroupKey[] = ["tv", "presa", "online", "agentie", "international", "moldova"];

/** Grupurile pentru care „nicio publicație” e o informație (nu presa externă sau cea din Moldova). */
const BLIND_GROUPS: GroupKey[] = ["tv", "presa", "online", "agentie"];

export interface Outlet {
  name: string;
  site: string;
  group: GroupKey;
}

export interface Coverage {
  groups: { key: GroupKey; label: string; covered: Outlet[]; silent: Outlet[] }[];
  coveredCount: number;
  relevantCount: number;
  /** Grupurile (cu cel puțin 3 publicații relevante) în care nimeni nu a relatat. */
  blind: GroupKey[];
}

function groupOf(kind: string | null, site: string): GroupKey {
  if (/\.md(\/|$)|moldova\.europalibera\.org|unimedia\.info/.test(site)) return "moldova";
  return (kind && kind in GROUPS ? kind : "online") as GroupKey;
}

/** Categoriile de fluxuri față de care comparăm un subiect dintr-o categorie. */
function feedCategories(category: CategorySlug): CategorySlug[] {
  if (category === "national" || category === "politica") return ["national", "politica"];
  if (category === "economie") return ["economie", "national"];
  if (category === "international") return ["international", "national"];
  return [category];
}

let cache: { at: number; byCat: Map<string, Outlet[]> } | null = null;

/** Publicațiile active (au publicat în ultimele 24 de ore) care acoperă categoria. */
export function relevantOutlets(category: CategorySlug): Outlet[] {
  if (!cache || Date.now() - cache.at > 5 * 60_000) cache = { at: Date.now(), byCat: new Map() };
  const hit = cache.byCat.get(category);
  if (hit) return hit;
  const cats = feedCategories(category);
  const rows = db()
    .prepare(
      `SELECT s.name, MIN(s.site) AS site, MIN(s.kind) AS kind
       FROM sources s
       WHERE s.enabled = 1 AND s.category IN (${cats.map(() => "?").join(",")})
         AND EXISTS (SELECT 1 FROM items i JOIN sources x ON x.id = i.source_id WHERE x.name = s.name AND i.fetched_at > ?)
         AND EXISTS (SELECT 1 FROM sources y WHERE y.name = s.name AND y.enabled = 1 AND y.last_status IN ('200', '304'))
       GROUP BY s.name ORDER BY s.name COLLATE NOCASE`
    )
    .all(...cats, Date.now() - 86400_000) as { name: string; site: string; kind: string | null }[];
  const list = rows.map((r) => ({ name: r.name, site: r.site, group: groupOf(r.kind, r.site) }));
  cache.byCat.set(category, list);
  return list;
}

const allOutlets = () =>
  new Map(
    (db().prepare("SELECT name, MIN(site) AS site, MIN(kind) AS kind FROM sources GROUP BY name").all() as { name: string; site: string; kind: string | null }[]).map((r) => [
      r.name,
      { name: r.name, site: r.site, group: groupOf(r.kind, r.site) },
    ])
  );

/**
 * Harta acoperirii unui subiect. `covered` = numele publicațiilor care au relatat; `age` = de cât
 * timp există subiectul (sub 3 ore nu declarăm „unghi mort”: redacțiile pot relata mai târziu).
 */
export function coverageOf(category: CategorySlug, covered: string[], age: number): Coverage {
  const relevant = relevantOutlets(category);
  const all = allOutlets();
  const coveredSet = new Set(covered);
  const byGroup = new Map<GroupKey, { covered: Outlet[]; silent: Outlet[] }>();
  const slot = (g: GroupKey) => byGroup.get(g) ?? (byGroup.set(g, { covered: [], silent: [] }), byGroup.get(g)!);
  for (const name of coveredSet) {
    const o = all.get(name);
    if (o) slot(o.group).covered.push(o);
  }
  for (const o of relevant) if (!coveredSet.has(o.name)) slot(o.group).silent.push(o);
  const coveredRelevant = relevant.filter((o) => coveredSet.has(o.name)).length;
  // Subiectul trebuie să fie relatat de presa „de aici” (nu doar de cea din Moldova sau de cea externă).
  const coveredHome = BLIND_GROUPS.reduce((n, g) => n + (byGroup.get(g)?.covered.length ?? 0), 0);
  const blind =
    age >= 3 * 3600_000 && coveredHome >= 4 && ["national", "politica", "economie", "international"].includes(category)
      ? BLIND_GROUPS.filter((g) => {
          const b = byGroup.get(g);
          return b && b.covered.length === 0 && b.silent.length >= 3;
        })
      : [];
  return {
    groups: ORDER.filter((g) => byGroup.has(g)).map((g) => ({ key: g, label: GROUPS[g], ...byGroup.get(g)! })),
    coveredCount: coveredRelevant,
    relevantCount: relevant.length,
    blind,
  };
}
