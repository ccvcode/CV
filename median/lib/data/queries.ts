import { config } from "../core/config";
import { db, today } from "../core/db";
import type { ArticleQuote, ArticleSection, ArticleSourceRef, CategorySlug, ImageRow, Img, RegionSlug } from "../core/types";

/*
 * Interogările folosite de paginile site-ului. Toate citesc din SQLite (sincron, rapid).
 * Textul surselor NU se afișează: doar titlul lor, maximum ~120 de caractere de extras și link.
 */

export const SNIPPET_MAX = 120;

export interface SourceChip {
  name: string;
  site: string;
  url: string;
  title: string;
  published: number;
  thumb?: Img;
}

export interface StoryCard {
  id: string;
  href: string;
  category: CategorySlug;
  region: RegionSlug | null;
  title: string;
  dek: string;
  kind: "full" | "brief" | "raw";
  sourceCount: number;
  sources: { name: string; site: string }[];
  published: number;
  updated: number;
  hero?: Img;
  thumb?: Img;
  breaking: boolean;
  readingTime: number;
  score: number;
}

/* ------------------------------------------------------------------ imagini */

export function toImg(row: ImageRow | undefined | null): Img | undefined {
  if (!row) return undefined;
  const base = { width: row.width ?? 1600, height: row.height ?? 900, color: row.color ?? undefined, credit: row.credit, creditUrl: row.credit_url ?? undefined, license: row.license ?? undefined, licenseUrl: row.license_url ?? undefined, kind: row.kind };
  if (row.kind === "unsplash") {
    const u = (w: number) => `${row.original_url}&w=${w}&fit=crop&crop=entropy&q=75&fm=webp&ar=16:9`;
    return { ...base, src: u(1200), srcSet: [480, 800, 1200, 1600].map((w) => `${u(w)} ${w}w`).join(", ") };
  }
  if (row.kind === "pexels") {
    const u = (w: number) => `${row.original_url}?auto=compress&cs=tinysrgb&fit=crop&w=${w}&h=${Math.round((w * 9) / 16)}`;
    return { ...base, src: u(1200), srcSet: [480, 800, 1200, 1600].map((w) => `${u(w)} ${w}w`).join(", ") };
  }
  if (!row.file_base) return undefined;
  const widths = JSON.parse(row.widths) as number[];
  if (!widths.length) return undefined;
  const largest = widths[widths.length - 1];
  const url = (w: number) => `/media/${row.file_base}-${w}.webp`;
  return { ...base, src: url(widths.includes(1200) ? 1200 : largest), srcSet: widths.map((w) => `${url(w)} ${w}w`).join(", ") };
}

function imageById(id: number | null | undefined): Img | undefined {
  if (!id) return undefined;
  return toImg(db().prepare("SELECT * FROM images WHERE id = ? AND status = 'ok'").get(id) as ImageRow | undefined);
}

/* ------------------------------------------------------------------ carduri */

interface StoryRow {
  id: string;
  slug: string;
  category: CategorySlug;
  region: RegionSlug | null;
  title: string;
  first_published_at: number;
  last_published_at: number;
  source_count: number;
  score: number;
  breaking: number;
  pinned: number;
  hero_image_id: number | null;
  article_id: number | null;
  a_kind: string | null;
  a_dek: string | null;
  a_words: number | null;
  a_published: number | null;
  a_updated: number | null;
}

const STORY_SELECT = `
  SELECT s.id, s.slug, s.category, s.region, s.title, s.first_published_at, s.last_published_at, s.source_count, s.score, s.breaking, s.pinned,
         s.hero_image_id, s.article_id, a.kind AS a_kind, a.dek AS a_dek, a.word_count AS a_words, a.published_at AS a_published, a.updated_at AS a_updated
  FROM stories s LEFT JOIN articles a ON a.id = s.article_id AND a.status = 'published'`;

/** Cu AI activ afișăm doar subiectele cu articol publicat; fără AI, afișăm agregarea brută. */
function visibility(): string {
  return aiMode() ? "s.status = 'active' AND a.id IS NOT NULL" : "s.status = 'active'";
}

export function aiMode(): boolean {
  if (config.llm.baseUrl) return true;
  // Chiar dacă AI-ul a fost oprit între timp, păstrăm articolele deja publicate.
  const row = db().prepare("SELECT 1 FROM articles WHERE status = 'published' LIMIT 1").get();
  return Boolean(row);
}

export function storyHref(s: { id: string; slug: string }): string {
  return `/stire/${s.slug ? s.slug + "-" : ""}${s.id}`;
}

function cards(rows: StoryRow[]): StoryCard[] {
  if (!rows.length) return [];
  const d = db();
  const ids = rows.map((r) => r.id);
  const ph = ids.map(() => "?").join(",");
  const items = d
    .prepare(
      `SELECT i.story_id, i.title, i.summary, i.thumb_image_id, i.published_at, s.name, s.site, s.tier
       FROM items i JOIN sources s ON s.id = i.source_id WHERE i.story_id IN (${ph}) AND i.duplicate_of IS NULL ORDER BY s.tier, i.published_at`
    )
    .all(...ids) as { story_id: string; title: string; summary: string; thumb_image_id: number | null; published_at: number; name: string; site: string }[];
  const byStory = new Map<string, typeof items>();
  for (const it of items) {
    let l = byStory.get(it.story_id);
    if (!l) byStory.set(it.story_id, (l = []));
    l.push(it);
  }
  return rows.map((r) => {
    const its = byStory.get(r.id) ?? [];
    const outlets = [...new Map(its.map((i) => [i.name, { name: i.name, site: i.site }])).values()];
    const thumbItem = its.find((i) => i.thumb_image_id);
    const kind = (r.a_kind as "full" | "brief" | null) ?? "raw";
    const dek = r.a_dek ?? snippet(its[0]?.summary ?? "");
    return {
      id: r.id,
      href: storyHref(r),
      category: r.category,
      region: r.region,
      title: r.title,
      dek,
      kind,
      sourceCount: Math.max(r.source_count, outlets.length),
      sources: outlets,
      published: r.a_published ?? r.first_published_at,
      updated: Math.max(r.last_published_at, r.a_updated ?? 0),
      hero: imageById(r.hero_image_id),
      thumb: imageById(thumbItem?.thumb_image_id),
      breaking: r.breaking === 1,
      readingTime: Math.max(1, Math.round((r.a_words ?? 60) / 220)),
      score: r.score,
    };
  });
}

/** Extras scurt din textul unei surse (limita legală pentru preluări: ~120 de caractere). */
export function snippet(s: string, max = SNIPPET_MAX): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[,.;:–-]+$/, "") + "…";
}

export function topStories(opts: { limit: number; hours?: number; category?: CategorySlug; region?: RegionSlug; exclude?: Set<string>; needHero?: boolean }): StoryCard[] {
  const hours = opts.hours ?? 30;
  const where = [visibility(), "s.last_published_at > @since"];
  if (opts.category) where.push("s.category = @category");
  if (opts.region) where.push("s.region = @region");
  if (opts.needHero) where.push("s.hero_image_id IS NOT NULL");
  const rows = db()
    .prepare(`${STORY_SELECT} WHERE ${where.join(" AND ")} ORDER BY s.pinned DESC, s.score DESC LIMIT @lim`)
    .all({ since: Date.now() - hours * 3600_000, category: opts.category ?? null, region: opts.region ?? null, lim: opts.limit + (opts.exclude?.size ?? 0) + 5 }) as StoryRow[];
  const out = rows.filter((r) => !opts.exclude?.has(r.id)).slice(0, opts.limit);
  for (const r of out) opts.exclude?.add(r.id);
  return cards(out);
}

export function latestStories(opts: { limit: number; offset?: number; category?: CategorySlug; region?: RegionSlug; before?: number }): StoryCard[] {
  const where = [visibility()];
  if (opts.category) where.push("s.category = @category");
  if (opts.region) where.push("s.region = @region");
  if (opts.before) where.push("COALESCE(a.published_at, s.first_published_at) < @before");
  const rows = db()
    .prepare(`${STORY_SELECT} WHERE ${where.join(" AND ")} ORDER BY COALESCE(a.published_at, s.first_published_at) DESC LIMIT @lim OFFSET @off`)
    .all({ category: opts.category ?? null, region: opts.region ?? null, before: opts.before ?? null, lim: opts.limit, off: opts.offset ?? 0 }) as StoryRow[];
  return cards(rows);
}

export function mostRead(limit = 10): { stories: StoryCard[]; byViews: boolean } {
  const d = db();
  const rows = d
    .prepare(
      `${STORY_SELECT} JOIN (SELECT story_id, SUM(count) AS n FROM views WHERE day >= @d1 GROUP BY story_id) v ON v.story_id = s.id
       WHERE ${visibility()} ORDER BY v.n DESC LIMIT @lim`
    )
    .all({ d1: today(Date.now() - 86400_000), lim: limit }) as StoryRow[];
  if (rows.length >= Math.min(5, limit)) return { stories: cards(rows), byViews: true };
  // Fără date de trafic suficiente: cele mai relatate subiecte ale zilei.
  const alt = d
    .prepare(`${STORY_SELECT} WHERE ${visibility()} AND s.last_published_at > @since ORDER BY s.source_count DESC, s.score DESC LIMIT @lim`)
    .all({ since: Date.now() - 24 * 3600_000, lim: limit }) as StoryRow[];
  return { stories: cards(alt), byViews: false };
}

export function breakingStories(limit = 8): StoryCard[] {
  const rows = db()
    .prepare(`${STORY_SELECT} WHERE ${visibility()} AND s.last_published_at > @since AND (s.breaking = 1 OR s.source_count >= 2) ORDER BY COALESCE(a.published_at, s.first_published_at) DESC LIMIT @lim`)
    .all({ since: Date.now() - 6 * 3600_000, lim: limit }) as StoryRow[];
  return cards(rows);
}

export function searchStories(q: string, limit = 40): StoryCard[] {
  const terms = q
    .replace(/["*():^]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .slice(0, 8)
    .map((t) => `"${t}"*`);
  if (!terms.length) return [];
  const ids = db().prepare("SELECT story_id FROM search WHERE search MATCH ? ORDER BY bm25(search, 0, 5, 1) LIMIT 200").all(terms.join(" ")) as { story_id: string }[];
  if (!ids.length) return [];
  const ph = ids.map(() => "?").join(",");
  const rows = db()
    .prepare(`${STORY_SELECT} WHERE s.id IN (${ph}) AND ${visibility()} ORDER BY s.last_published_at DESC LIMIT ${limit}`)
    .all(...ids.map((i) => i.story_id)) as StoryRow[];
  return cards(rows);
}

/* ------------------------------------------------------------------ pagina de știre */

export interface StoryDetail {
  card: StoryCard;
  article?: {
    id: number;
    kind: "full" | "brief";
    headline: string;
    dek: string;
    keyPoints: string[];
    sections: ArticleSection[];
    why: string;
    context: string;
    quotes: ArticleQuote[];
    tags: string[];
    sources: ArticleSourceRef[];
    wordCount: number;
    model: string | null;
    published: number;
    updated: number;
    version: number;
  };
  sources: SourceChip[];
  corrections: { text: string; created_at: number }[];
  related: StoryCard[];
  status: string;
}

export function getStory(id: string, opts: { preview?: boolean } = {}): StoryDetail | undefined {
  const d = db();
  const row = d.prepare(`${STORY_SELECT} WHERE s.id = ?`).get(id) as (StoryRow & { status?: string }) | undefined;
  if (!row) return undefined;
  const st = d.prepare("SELECT status FROM stories WHERE id = ?").get(id) as { status: string };
  if (st.status !== "active" && !opts.preview) return undefined;
  const [card] = cards([row]);
  const a = (row.article_id
    ? d.prepare("SELECT * FROM articles WHERE id = ?").get(row.article_id)
    : opts.preview
      ? d.prepare("SELECT * FROM articles WHERE story_id = ? ORDER BY version DESC LIMIT 1").get(id)
      : undefined) as
    | {
        id: number;
        kind: "full" | "brief";
        headline: string;
        dek: string;
        key_points: string;
        sections: string;
        why: string;
        context: string;
        quotes: string;
        tags: string;
        sources: string;
        word_count: number;
        model: string | null;
        published_at: number | null;
        updated_at: number;
        created_at: number;
        version: number;
        status: string;
      }
    | undefined;
  if (aiMode() && !a && !opts.preview) return undefined;

  const items = d
    .prepare(
      `SELECT i.url, i.title, i.published_at, i.thumb_image_id, s.name, s.site FROM items i JOIN sources s ON s.id = i.source_id
       WHERE i.story_id = ? ORDER BY i.published_at`
    )
    .all(id) as { url: string; title: string; published_at: number; thumb_image_id: number | null; name: string; site: string }[];
  const sources: SourceChip[] = items.map((i) => ({ name: i.name, site: i.site, url: i.url, title: i.title, published: i.published_at, thumb: imageById(i.thumb_image_id) }));
  const corrections = d.prepare("SELECT text, created_at FROM corrections WHERE story_id = ? ORDER BY created_at").all(id) as { text: string; created_at: number }[];

  // Subiecte legate: aceeași categorie, cuvinte-cheie comune.
  const kw = (d.prepare("SELECT keywords FROM stories WHERE id = ?").get(id) as { keywords: string }).keywords.split(" ").slice(0, 8);
  let related: StoryCard[] = [];
  if (kw.length) {
    const ids = (
      d.prepare("SELECT story_id FROM search WHERE search MATCH ? AND story_id != ? LIMIT 30").all(kw.map((k) => `"${k}"*`).join(" OR "), id) as { story_id: string }[]
    ).map((r) => r.story_id);
    if (ids.length) {
      const rows = d
        .prepare(`${STORY_SELECT} WHERE s.id IN (${ids.map(() => "?").join(",")}) AND ${visibility()} ORDER BY s.last_published_at DESC LIMIT 4`)
        .all(...ids) as StoryRow[];
      related = cards(rows);
    }
  }
  if (related.length < 4) {
    const more = latestStories({ limit: 8, category: row.category }).filter((c) => c.id !== id && !related.some((r) => r.id === c.id));
    related = [...related, ...more].slice(0, 6);
  }

  return {
    card,
    article: a
      ? {
          id: a.id,
          kind: a.kind,
          headline: a.headline,
          dek: a.dek,
          keyPoints: JSON.parse(a.key_points),
          sections: JSON.parse(a.sections),
          why: a.why,
          context: a.context,
          quotes: JSON.parse(a.quotes),
          tags: JSON.parse(a.tags),
          sources: JSON.parse(a.sources),
          wordCount: a.word_count,
          model: a.model,
          published: a.published_at ?? a.created_at,
          updated: a.updated_at,
          version: a.version,
        }
      : undefined,
    sources,
    corrections,
    related,
    status: st.status,
  };
}

export function recordView(storyId: string) {
  db()
    .prepare("INSERT INTO views(story_id, day, count) VALUES (?, ?, 1) ON CONFLICT(story_id, day) DO UPDATE SET count = count + 1")
    .run(storyId, today());
}

/* ------------------------------------------------------------------ stare generală */

export function siteStatus() {
  const d = db();
  const last = d.prepare("SELECT MAX(last_fetch_at) AS t FROM sources WHERE enabled = 1").get() as { t: number | null };
  const ok = d.prepare("SELECT COUNT(*) AS n FROM sources WHERE enabled = 1 AND last_status IN ('200','304')").get() as { n: number };
  const total = d.prepare("SELECT COUNT(*) AS n FROM sources WHERE enabled = 1").get() as { n: number };
  const outlets = d.prepare("SELECT COUNT(DISTINCT name) AS n FROM sources WHERE enabled = 1").get() as { n: number };
  const latestArticle = d.prepare("SELECT MAX(published_at) AS t FROM articles WHERE status = 'published'").get() as { t: number | null };
  const stories = d.prepare("SELECT COUNT(*) AS n FROM stories WHERE last_published_at > ?").get(Date.now() - 86400_000) as { n: number };
  return {
    lastFetch: last.t ?? 0,
    lastArticle: latestArticle.t ?? 0,
    sourcesOk: ok.n,
    sourcesTotal: total.n,
    outlets: outlets.n,
    storiesToday: stories.n,
    demo: config.demo,
    ai: aiMode(),
  };
}

/** Numărul de subiecte noi (vizibile) apărute după un moment dat — pentru butonul „N știri noi”. */
export function countNewSince(ts: number): number {
  const row = db()
    .prepare(`SELECT COUNT(*) AS n FROM stories s LEFT JOIN articles a ON a.id = s.article_id AND a.status = 'published' WHERE ${visibility()} AND COALESCE(a.published_at, s.created_at) > ?`)
    .get(ts) as { n: number };
  return row.n;
}

export function outletsList() {
  return db()
    .prepare(
      `SELECT name, MIN(site) AS site, MIN(tier) AS tier, GROUP_CONCAT(category) AS categories,
              SUM(CASE WHEN last_status IN ('200','304') THEN 1 ELSE 0 END) AS ok, COUNT(*) AS feeds, MAX(last_fetch_at) AS last_fetch
       FROM sources WHERE enabled = 1 GROUP BY name ORDER BY name COLLATE NOCASE`
    )
    .all() as { name: string; site: string; tier: number; categories: string; ok: number; feeds: number; last_fetch: number | null }[];
}
