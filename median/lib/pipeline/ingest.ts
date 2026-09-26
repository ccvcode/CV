import { config, llmEnabled } from "../core/config";
import { db, logEvent } from "../core/db";
import { SOURCES } from "../core/sources";
import type { CategorySlug, ParsedItem } from "../core/types";
import { hashId, slugify } from "../core/utils";
import { httpGet } from "./http";
import { enqueue } from "./jobs";
import { parseFeed } from "./rss";
import { detectRegion, detectSensitive, entities, fingerprint, fingerprintSimilarity, keywords } from "./text";

const WINDOW_MS = 36 * 3600_000;

interface SourceRow {
  id: string;
  name: string;
  site: string;
  feed_url: string;
  category: CategorySlug;
  tier: number;
  enabled: number;
  etag: string | null;
  last_modified: string | null;
  next_fetch_at: number;
  fail_count: number;
}

/** Sincronizează lista de surse din cod în baza de date (fără să atingă setările din admin). */
export function syncSources(list = SOURCES) {
  const d = db();
  const upsert = d.prepare(
    `INSERT INTO sources(id, name, site, feed_url, category, kind, tier)
     VALUES (@id, @name, @site, @url, @category, @kind, @tier)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, site = excluded.site, feed_url = excluded.feed_url,
       category = excluded.category, kind = excluded.kind, tier = excluded.tier`
  );
  d.transaction(() => {
    for (const s of list) upsert.run({ ...s, kind: s.kind ?? null });
  })();
}

/** Preia toate fluxurile scadente, în paralel (limitat). Întoarce numărul de articole noi. */
export async function ingestDue(now = Date.now()): Promise<{ fetched: number; newItems: number; failed: number }> {
  const due = db().prepare("SELECT * FROM sources WHERE enabled = 1 AND next_fetch_at <= ? ORDER BY next_fetch_at").all(now) as SourceRow[];
  let newItems = 0;
  let failed = 0;
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(8, due.length) }, async () => {
      while (i < due.length) {
        const src = due[i++];
        try {
          const n = await ingestSource(src, now);
          newItems += n;
        } catch {
          failed++;
        }
      }
    })
  );
  if (due.length) {
    const n = clusterPending(now);
    if (newItems || n) logEvent("info", `colectare: ${due.length - failed}/${due.length} fluxuri OK, ${newItems} articole noi, ${n} grupate`);
  }
  return { fetched: due.length, newItems, failed };
}

async function ingestSource(src: SourceRow, now: number): Promise<number> {
  const d = db();
  try {
    const res = await httpGet(src.feed_url, { timeoutMs: 15_000, etag: src.etag, lastModified: src.last_modified });
    if (res.notModified) {
      d.prepare("UPDATE sources SET last_fetch_at = ?, last_status = '304', fail_count = 0, last_error = NULL, next_fetch_at = ? WHERE id = ?").run(
        now,
        now + config.fetchIntervalMs,
        src.id
      );
      return 0;
    }
    const items = parseFeed(res.text, src.site, now);
    if (!items.length) throw new Error("flux gol sau invalid");
    const added = insertItems(src, items, now);
    d.prepare(
      `UPDATE sources SET last_fetch_at = ?, last_status = '200', fail_count = 0, last_error = NULL, next_fetch_at = ?,
         etag = ?, last_modified = ?, items_total = items_total + ? WHERE id = ?`
    ).run(now, now + config.fetchIntervalMs, res.headers.get("etag"), res.headers.get("last-modified"), added, src.id);
    return added;
  } catch (e) {
    const fails = src.fail_count + 1;
    // Back-off exponențial: 5 min, 10, 20, 40... maxim 6 ore.
    const wait = Math.min(6 * 3600_000, config.fetchIntervalMs * 2 ** Math.min(fails - 1, 7));
    d.prepare("UPDATE sources SET last_fetch_at = ?, last_status = 'error', fail_count = ?, last_error = ?, next_fetch_at = ? WHERE id = ?").run(
      now,
      fails,
      (e as Error).message.slice(0, 300),
      now + wait,
      src.id
    );
    throw e;
  }
}

export function insertItems(src: Pick<SourceRow, "id" | "category">, items: ParsedItem[], now: number): number {
  const d = db();
  const insert = d.prepare(
    `INSERT OR IGNORE INTO items(id, source_id, url, title, summary, author, category, published_at, fetched_at, fingerprint, image_candidates)
     VALUES (@id, @source, @url, @title, @summary, @author, @category, @published, @now, @fp, @images)`
  );
  let added = 0;
  d.transaction(() => {
    for (const it of items) {
      // Ignorăm articolele foarte vechi (fluxuri care republică arhiva).
      if (now - it.published > 3 * 86400_000) continue;
      const r = insert.run({
        id: it.id,
        source: src.id,
        url: it.url,
        title: it.title,
        summary: it.summary,
        author: it.author ?? null,
        category: src.category,
        published: it.published,
        now,
        fp: fingerprint(it.title + " " + it.summary),
        images: JSON.stringify(it.images),
      });
      added += r.changes;
    }
  })();
  return added;
}

/* ------------------------------------------------------------------ grupare pe subiecte */

interface ItemRow {
  id: string;
  source_id: string;
  title: string;
  summary: string;
  category: CategorySlug;
  published_at: number;
  story_id: string | null;
  fingerprint: string;
}

/**
 * Atribuie fiecărui articol nou un subiect (story). Două articole de la publicații diferite fac parte
 * din același subiect dacă titlurile împart suficiente cuvinte-cheie (inclusiv nume proprii) într-o
 * fereastră de 36 de ore. Preluările aproape identice (ex. din aceeași agenție) sunt marcate ca duplicate.
 */
export function clusterPending(now = Date.now()): number {
  const d = db();
  const pending = d.prepare("SELECT id, source_id, title, summary, category, published_at, story_id, fingerprint FROM items WHERE story_id IS NULL ORDER BY published_at").all() as ItemRow[];
  if (!pending.length) return 0;
  const recent = d
    .prepare("SELECT id, source_id, title, summary, category, published_at, story_id, fingerprint FROM items WHERE story_id IS NOT NULL AND published_at > ?")
    .all(now - WINDOW_MS - 12 * 3600_000) as ItemRow[];

  type Entry = { row: ItemRow; kw: Set<string>; ent: Set<string> };
  const index = new Map<string, Entry[]>();
  const add = (row: ItemRow) => {
    const e: Entry = { row, kw: new Set(keywords(row.title)), ent: new Set(entities(row.title)) };
    for (const k of e.kw) {
      let l = index.get(k);
      if (!l) index.set(k, (l = []));
      l.push(e);
    }
    return e;
  };
  for (const r of recent) add(r);

  const touched = new Set<string>();
  const setStory = d.prepare("UPDATE items SET story_id = ?, duplicate_of = ? WHERE id = ?");
  d.transaction(() => {
    for (const row of pending) {
      const kw = new Set(keywords(row.title));
      const ent = new Set(entities(row.title));
      const counts = new Map<Entry, number>();
      for (const k of kw) for (const e of index.get(k) ?? []) counts.set(e, (counts.get(e) ?? 0) + 1);
      let best: { e: Entry; score: number } | undefined;
      for (const [e, shared] of counts) {
        if (Math.abs(e.row.published_at - row.published_at) > WINDOW_MS) continue;
        if (!e.row.story_id) continue;
        const minSize = Math.max(1, Math.min(kw.size, e.kw.size));
        const overlap = shared / minSize;
        let sharedEnt = 0;
        for (const x of ent) if (e.ent.has(x)) sharedEnt++;
        const ok = (shared >= 3 && overlap >= 0.5) || (shared >= 2 && sharedEnt >= 1 && overlap >= 0.6) || (sharedEnt >= 2 && overlap >= 0.4);
        if (!ok) continue;
        const score = overlap + sharedEnt * 0.2 + (e.row.source_id === row.source_id ? -0.3 : 0);
        if (!best || score > best.score) best = { e, score };
      }
      let storyId = best?.e.row.story_id ?? null;
      let duplicateOf: string | null = null;
      if (best && fingerprintSimilarity(row.fingerprint, best.e.row.fingerprint) > 0.8) duplicateOf = best.e.row.id;
      if (!storyId) storyId = createStory(row, now);
      setStory.run(storyId, duplicateOf, row.id);
      row.story_id = storyId;
      add(row);
      touched.add(storyId);
    }
  })();
  for (const id of touched) refreshStory(id, now);
  return pending.length;
}

function createStory(row: ItemRow, now: number): string {
  const id = "s" + hashId(row.id).slice(0, 9);
  db()
    .prepare(
      `INSERT OR IGNORE INTO stories(id, slug, category, title, created_at, updated_at, first_published_at, last_published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, slugify(row.title, 80), row.category, row.title, now, now, row.published_at, row.published_at);
  return id;
}

/** Recalculează numărul de surse, categoria, regiunea, scorul și decide ce joburi urmează. */
export function refreshStory(storyId: string, now = Date.now()) {
  const d = db();
  const items = d
    .prepare(
      `SELECT i.id, i.title, i.summary, i.category, i.published_at, i.duplicate_of, s.name, s.tier, s.id AS source_id
       FROM items i JOIN sources s ON s.id = i.source_id WHERE i.story_id = ? ORDER BY i.published_at`
    )
    .all(storyId) as { id: string; title: string; summary: string; category: CategorySlug; published_at: number; duplicate_of: string | null; name: string; tier: number; source_id: string }[];
  if (!items.length) return;
  const story = d.prepare("SELECT * FROM stories WHERE id = ?").get(storyId) as { category: CategorySlug; article_id: number | null; written_source_count: number; written_at: number | null; status: string };

  const outlets = new Map<string, number>();
  for (const it of items) if (!it.duplicate_of) outlets.set(it.name, Math.min(outlets.get(it.name) ?? 9, it.tier));
  const sourceCount = Math.max(1, outlets.size);
  const tier1 = [...outlets.values()].filter((t) => t === 1).length;

  // Categoria: cea mai specifică (non-„național”) cea mai frecventă.
  const catCount = new Map<CategorySlug, number>();
  for (const it of items) catCount.set(it.category, (catCount.get(it.category) ?? 0) + (it.category === "national" ? 0.6 : 1));
  const category = [...catCount.entries()].sort((a, b) => b[1] - a[1])[0][0];

  const text = items.map((i) => i.title + " " + i.summary.slice(0, 400)).join(" ");
  const region = category === "international" ? detectRegion(text) ?? "lume" : null;
  const sensitive = detectSensitive(items.map((i) => i.title).join(" ")).join(",") || null;

  const first = items[0].published_at;
  const last = items[items.length - 1].published_at;
  const recentHour = items.filter((i) => now - i.published_at < 3600_000).length;
  const ageH = Math.max(0, (now - last) / 3600_000);
  const score = (2.2 * Math.log(1 + sourceCount) + 0.6 * tier1 + 0.4 * Math.min(recentHour, 5) + 0.5) / Math.pow(ageH + 2, 1.5);

  // Titlul de lucru: al publicației cu cel mai înalt nivel, cea mai veche (până la articolul AI).
  const lead = [...items].sort((a, b) => a.tier - b.tier || a.published_at - b.published_at)[0];
  const kw = [...new Set(items.flatMap((i) => keywords(i.title)))].slice(0, 40).join(" ");

  d.prepare(
    `UPDATE stories SET category = ?, region = ?, sensitive = ?, source_count = ?, item_count = ?, score = ?,
       first_published_at = ?, last_published_at = ?, updated_at = ?, keywords = ?,
       title = CASE WHEN article_id IS NULL THEN ? ELSE title END,
       slug = CASE WHEN article_id IS NULL THEN ? ELSE slug END
     WHERE id = ?`
  ).run(category, region, sensitive, sourceCount, items.length, score, first, last, now, kw, lead.title, slugify(lead.title, 80), storyId);

  d.prepare("DELETE FROM search WHERE story_id = ?").run(storyId);
  d.prepare("INSERT INTO search(story_id, title, body) VALUES (?, ?, ?)").run(storyId, items.map((i) => i.title).join(" · "), items.map((i) => i.summary.slice(0, 500)).join(" "));

  if (story.status !== "active") return;
  // Miniaturi pentru fiecare articol-sursă (poza publicației, afișată mic, cu credit).
  for (const it of items) enqueue("thumb", `thumb:${it.id}`, { itemId: it.id }, { priority: 1 });
  // Articol complet când subiectul are ≥2 publicații; se rescrie când apar ≥2 surse noi (max. o dată pe 30 min).
  if (!llmEnabled()) {
    // Fără AI: site-ul funcționează ca agregator; subiectele cu mai multe surse primesc o imagine principală.
    if (sourceCount >= 2) enqueue("image", `image:${storyId}:raw`, { storyId }, { priority: 1, delayMs: 20_000 });
    return;
  }
  const due = sourceCount >= 2 && (!story.article_id || (sourceCount >= story.written_source_count + 2 && now - (story.written_at ?? 0) > 30 * 60_000));
  if (due) {
    for (const it of items) enqueue("extract", `extract:${it.id}`, { itemId: it.id }, { priority: 2 });
    enqueue("write", `write:${storyId}:${sourceCount}`, { storyId }, { priority: Math.round(score * 10), delayMs: 60_000 });
  } else if (sourceCount === 1 && !story.article_id) {
    enqueue("brief", `brief:${storyId}`, { storyId }, { priority: Math.round(score * 10), delayMs: 30_000 });
  }
}

/** Recalculează scorurile tuturor subiectelor recente (scorul scade odată cu vârsta). */
export function rescoreRecent(now = Date.now()) {
  const d = db();
  const rows = d.prepare("SELECT id, source_count, last_published_at, score FROM stories WHERE last_published_at > ?").all(now - 3 * 86400_000) as {
    id: string;
    source_count: number;
    last_published_at: number;
  }[];
  const upd = d.prepare("UPDATE stories SET score = ? WHERE id = ?");
  d.transaction(() => {
    for (const r of rows) {
      const ageH = Math.max(0, (now - r.last_published_at) / 3600_000);
      const tierBonus = 0; // bonusul de nivel se aplică la actualizarea completă a subiectului
      upd.run((2.2 * Math.log(1 + r.source_count) + tierBonus + 0.5) / Math.pow(ageH + 2, 1.5), r.id);
    }
  })();
}
