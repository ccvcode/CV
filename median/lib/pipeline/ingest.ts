import { config, llmEnabled } from "../core/config";
import { db, logEvent } from "../core/db";
import { SOURCES } from "../core/sources";
import type { CategorySlug, ParsedItem } from "../core/types";
import { hashId, slugify } from "../core/utils";
import { httpGet } from "./http";
import { enqueue } from "./jobs";
import { parseFeed } from "./rss";
import { byCentrality, classifyCategory, detectRegion, detectSensitive, docVector, fingerprint, fingerprintSimilarity, keywords, sameStory, type DocVector } from "./text";

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
 * Atribuie fiecărui articol nou un subiect (story). Un articol intră în subiectul celui mai asemănător
 * articol recent de la altă publicație (TF-IDF pe titlu + început, confirmat de nume proprii sau cifre
 * comune), într-o fereastră de 36 de ore. Preluările aproape identice sunt marcate ca duplicate.
 * Calitatea este măsurată pe rețeaua demo cu scripts/eval/cluster-eval.ts.
 */
export function clusterPending(now = Date.now()): number {
  const d = db();
  const pending = d.prepare("SELECT id, source_id, title, summary, category, published_at, story_id, fingerprint FROM items WHERE story_id IS NULL ORDER BY published_at").all() as ItemRow[];
  if (!pending.length) return 0;
  const recent = d
    .prepare("SELECT id, source_id, title, summary, category, published_at, story_id, fingerprint FROM items WHERE story_id IS NOT NULL AND published_at > ?")
    .all(now - WINDOW_MS - 12 * 3600_000) as ItemRow[];

  type Entry = { row: ItemRow; vec: DocVector };
  const entries: Entry[] = recent.map((row) => ({ row, vec: docVector(row.title, row.summary) }));
  const pendingEntries: Entry[] = pending.map((row) => ({ row, vec: docVector(row.title, row.summary) }));
  // Frecvența documentelor (pentru IDF) pe toată fereastra.
  const df = new Map<string, number>();
  for (const e of [...entries, ...pendingEntries]) for (const t of Object.keys(e.vec.terms)) df.set(t, (df.get(t) ?? 0) + 1);
  const N = Math.max(50, entries.length + pendingEntries.length);
  const idf = (t: string) => Math.log(1 + N / (df.get(t) ?? 1));
  // Index invers pe termeni, ca să comparăm doar cu candidații care au ceva în comun.
  const index = new Map<string, Entry[]>();
  const addToIndex = (e: Entry) => {
    for (const t of Object.keys(e.vec.terms)) {
      let l = index.get(t);
      if (!l) index.set(t, (l = []));
      l.push(e);
    }
  };
  for (const e of entries) addToIndex(e);

  const touched = new Set<string>();
  const setStory = d.prepare("UPDATE items SET story_id = ?, duplicate_of = ? WHERE id = ?");
  d.transaction(() => {
    for (const e of pendingEntries) {
      const row = e.row;
      const candidates = new Set<Entry>();
      for (const t of Object.keys(e.vec.terms)) for (const c of index.get(t) ?? []) candidates.add(c);
      let best: { e: Entry; score: number } | undefined;
      for (const c of candidates) {
        if (!c.row.story_id || c.row.source_id === row.source_id) continue;
        if (Math.abs(c.row.published_at - row.published_at) > WINDOW_MS) continue;
        const r = sameStory(e.vec, c.vec, idf);
        if (r.same && (!best || r.score > best.score)) best = { e: c, score: r.score };
      }
      let storyId = best?.e.row.story_id ?? null;
      let duplicateOf: string | null = null;
      if (best && fingerprintSimilarity(row.fingerprint, best.e.row.fingerprint) > 0.8) duplicateOf = best.e.row.id;
      if (!storyId) storyId = createStory(row, now);
      setStory.run(storyId, duplicateOf, row.id);
      row.story_id = storyId;
      addToIndex(e);
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
  let category = [...catCount.entries()].sort((a, b) => b[1] - a[1])[0][0];
  // Fluxuri generale („național”): încercăm o clasificare după conținut. Articolul AI o rafinează.
  if (category === "national") category = (classifyCategory(items.map((i) => i.title), items.map((i) => i.summary)) as CategorySlug | undefined) ?? "national";
  // Dacă există deja un articol publicat, categoria aleasă de redactor are prioritate.
  if (story.article_id) {
    const a = d.prepare("SELECT s2.category FROM stories s2 WHERE s2.id = ?").get(storyId) as { category: CategorySlug };
    category = a.category;
  }

  const text = items.map((i) => i.title + " " + i.summary.slice(0, 400)).join(" ");
  const region = category === "international" ? detectRegion(text) ?? "lume" : null;
  const sensitive = detectSensitive(items.map((i) => i.title).join(" ")).join(",") || null;

  const first = items[0].published_at;
  const last = items[items.length - 1].published_at;
  const recentHour = items.filter((i) => now - i.published_at < 3600_000).length;
  const ageH = Math.max(0, (now - last) / 3600_000);
  const score = storyScore(sourceCount, tier1, recentHour, ageH);

  // Titlul de lucru (până la articolul AI): articolul cel mai reprezentativ pentru subiect.
  const lead = byCentrality(items.filter((i) => !i.duplicate_of).length ? items.filter((i) => !i.duplicate_of) : items)[0];
  const kw = [...new Set(items.flatMap((i) => keywords(i.title)))].slice(0, 40).join(" ");

  d.prepare(
    `UPDATE stories SET category = ?, region = ?, sensitive = ?, source_count = ?, item_count = ?, score = ?,
       first_published_at = ?, last_published_at = ?, updated_at = ?, keywords = ?,
       title = CASE WHEN article_id IS NULL THEN ? ELSE title END,
       slug = CASE WHEN article_id IS NULL THEN ? ELSE slug END,
       lead_item_id = ?
     WHERE id = ?`
  ).run(category, region, sensitive, sourceCount, items.length, score, first, last, now, kw, lead.title, slugify(lead.title, 80), lead.id, storyId);

  d.prepare("DELETE FROM search WHERE story_id = ?").run(storyId);
  d.prepare("INSERT INTO search(story_id, title, body) VALUES (?, ?, ?)").run(storyId, items.map((i) => i.title).join(" · "), items.map((i) => i.summary.slice(0, 500)).join(" "));

  if (story.status !== "active") return;
  // Miniaturi pentru fiecare articol-sursă (poza publicației, afișată mic, cu credit).
  for (const it of items) enqueue("thumb", `thumb:${it.id}`, { itemId: it.id }, { priority: 1 });
  // Există deja un articol (publicat sau la aprobare)? Atunci rescriem doar când apar ≥2 surse noi.
  const existing = d
    .prepare("SELECT kind FROM articles WHERE story_id = ? AND status IN ('published','review') ORDER BY version DESC LIMIT 1")
    .get(storyId) as { kind: string } | undefined;
  const hasFull = existing?.kind === "full";
  const due =
    sourceCount >= 2 &&
    (!hasFull || (sourceCount >= story.written_source_count + 2 && now - (story.written_at ?? 0) > 30 * 60_000));
  if (due) {
    for (const it of items) enqueue("extract", `extract:${it.id}`, { itemId: it.id }, { priority: 2 });
    enqueue("write", `write:${storyId}`, { storyId }, { priority: Math.round(score * 10), delayMs: 60_000, requeue: true });
  } else if (sourceCount === 1 && !existing) {
    enqueue("brief", `brief:${storyId}`, { storyId }, { priority: Math.round(score * 10), delayMs: 30_000 });
  }
  // Fără redactor AI, subiectele apar ca agregare: poza principală se alege direct (cu AI, după redactare).
  if (!llmEnabled()) {
    const hero = d.prepare("SELECT i.kind FROM stories s JOIN images i ON i.id = s.hero_image_id WHERE s.id = ?").get(storyId) as { kind: string } | undefined;
    if (!hero || hero.kind === "card")
      enqueue("image", `image:${storyId}:raw`, { storyId }, { priority: Math.round(score * 10), delayMs: 15_000, requeue: true });
  }
}

export function storyScore(sourceCount: number, tier1: number, recentHour: number, ageH: number): number {
  return (2.2 * Math.log(1 + sourceCount) + 0.6 * tier1 + 0.4 * Math.min(recentHour, 5) + 0.5) / Math.pow(ageH + 2, 1.5);
}

/** Recalculează scorurile subiectelor recente (scorul scade odată cu vârsta), cu aceeași formulă. */
export function rescoreRecent(now = Date.now()) {
  const d = db();
  const rows = d
    .prepare(
      `SELECT st.id, st.source_count, st.last_published_at,
              COUNT(DISTINCT CASE WHEN s.tier = 1 AND i.duplicate_of IS NULL THEN s.name END) AS tier1,
              SUM(CASE WHEN i.published_at > @hour THEN 1 ELSE 0 END) AS recent
       FROM stories st JOIN items i ON i.story_id = st.id JOIN sources s ON s.id = i.source_id
       WHERE st.last_published_at > @since GROUP BY st.id`
    )
    .all({ since: now - 3 * 86400_000, hour: now - 3600_000 }) as { id: string; source_count: number; last_published_at: number; tier1: number; recent: number }[];
  const upd = d.prepare("UPDATE stories SET score = ? WHERE id = ?");
  d.transaction(() => {
    for (const r of rows) upd.run(storyScore(r.source_count, r.tier1, r.recent, Math.max(0, (now - r.last_published_at) / 3600_000)), r.id);
  })();
}
