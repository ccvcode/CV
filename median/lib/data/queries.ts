import { config } from "../core/config";
import { db, today } from "../core/db";
import { entities, fold, GENERIC_ENTITIES, keywords, properNames } from "../pipeline/text";
import { type Coverage, coverageOf, type GroupKey } from "./coverage";
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
  /** Articolul reprezentativ al subiectului (dă titlul de lucru și extrasul). */
  lead?: boolean;
  /** Extras scurt (sub limita legală de ~120 de caractere) din rezumatul sursei. */
  excerpt?: string;
  /** Ora nu e sigură: fluxul a dat aceeași oră mai multor articole (ora colectării). */
  timeUncertain?: boolean;
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
  // Variantele nu sunt niciodată mărite: cea mai mare are cel mult lățimea originalului.
  const maxWidth = Math.min(largest, row.width ?? largest);
  return {
    ...base,
    src: url(widths.includes(1200) ? 1200 : largest),
    srcSet: widths.map((w) => `${url(w)} ${Math.min(w, maxWidth)}w`).join(", "),
    maxWidth,
    smallSrc: url(widths[0]),
  };
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
  lead_item_id: string | null;
  article_id: number | null;
  a_kind: string | null;
  a_dek: string | null;
  a_words: number | null;
  a_published: number | null;
  a_updated: number | null;
}

const STORY_SELECT = `
  SELECT s.id, s.slug, s.category, s.region, s.title, s.first_published_at, s.last_published_at, s.source_count, s.score, s.breaking, s.pinned,
         s.hero_image_id, s.lead_item_id, s.article_id, a.kind AS a_kind, a.dek AS a_dek, a.word_count AS a_words, a.published_at AS a_published, a.updated_at AS a_updated
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
      `SELECT i.id, i.story_id, i.title, i.summary, i.thumb_image_id, i.published_at, s.name, s.site, s.tier
       FROM items i JOIN sources s ON s.id = i.source_id WHERE i.story_id IN (${ph}) AND i.duplicate_of IS NULL ORDER BY s.tier, i.published_at`
    )
    .all(...ids) as { id: string; story_id: string; title: string; summary: string; thumb_image_id: number | null; published_at: number; name: string; site: string }[];
  const byStory = new Map<string, typeof items>();
  for (const it of items) {
    let l = byStory.get(it.story_id);
    if (!l) byStory.set(it.story_id, (l = []));
    l.push(it);
  }
  return rows.map((r) => {
    const its = byStory.get(r.id) ?? [];
    const outlets = [...new Map(its.map((i) => [i.name, { name: i.name, site: i.site }])).values()];
    // Miniatura: întâi a articolului reprezentativ (cel care dă și titlul de lucru).
    const thumbItem = its.find((i) => i.id === r.lead_item_id && i.thumb_image_id) ?? its.find((i) => i.thumb_image_id);
    const kind = (r.a_kind as "full" | "brief" | null) ?? "raw";
    const leadItem = its.find((i) => i.id === r.lead_item_id) ?? its[0];
    const dek = r.a_dek ?? (leadItem ? excerptOf(leadItem.title, leadItem.summary) ?? "" : "");
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
      // Momentul în care a apărut știrea (primul raport), nu momentul redactării sintezei.
      published: r.first_published_at,
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

const TITLE_STOP = new Set(
  "dupa pentru despre care este sunt cele cele mai acum anul inca doar fara prin catre intre toate totul spune spus anunta anuntat romania romaniei romanii romani".split(" ")
);
function titleTokens(t: string): Set<string> {
  return new Set(
    fold(t)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !TITLE_STOP.has(w))
      .map((w) => w.slice(0, 7))
  );
}

/**
 * Două subiecte care, pentru cititor, spun același lucru („Mureșan a depus programul de guvernare” și
 * „Programul de guvernare al lui Mureșan: măsurile”): cel puțin trei elemente comune în titlu (un nume
 * propriu, oricât de lung, contează o singură dată), sau două care fac jumătate din titlul mai scurt.
 * Știrile diferite despre aceeași persoană („Mureșan, despre alegeri anticipate”) rămân separate.
 */
export function nearDuplicate(a: string, b: string): boolean {
  const names = new Set([...titleNames(a), ...titleNames(b)]);
  const x = titleTokens(a);
  const y = titleTokens(b);
  const shared = [...x].filter((w) => y.has(w));
  const plain = shared.filter((w) => !names.has(w)).length;
  const n = plain + (shared.length > plain ? 1 : 0);
  const size = (t: Set<string>) => [...t].filter((w) => !names.has(w)).length + ([...t].some((w) => names.has(w)) ? 1 : 0);
  return n >= 3 || (n >= 2 && n * 2 >= Math.min(size(x), size(y)));
}

/** Au un nume propriu specific comun în titlu (aceeași persoană, companie, loc). */
export function sharesName(a: string, b: string): boolean {
  const x = titleNames(a);
  return [...titleNames(b)].some((n) => x.has(n));
}

function titleNames(t: string): Set<string> {
  return new Set(
    t
      .split(/\s+/)
      .slice(1)
      .filter((w) => /^[„"“]?[A-ZĂÂÎȘȚ][a-zăâîșț]/.test(w))
      .map((w) => fold(w).replace(/[^a-z0-9]/g, ""))
      .filter((w) => w.length >= 4 && !GENERIC_ENTITIES.has(w) && !GENERIC_ENTITIES.has(w.slice(0, 6)))
      .map((w) => w.slice(0, 7))
  );
}

/** Păstrează ordinea, dar sare peste subiectele care repetă unul deja ales (și peste cele din „shown”). */
export function distinctStories<T extends { title: string }>(list: T[], shown: { title: string }[] = []): T[] {
  const out: T[] = [];
  for (const s of list) if (![...shown, ...out].some((o) => nearDuplicate(o.title, s.title))) out.push(s);
  return out;
}

export function topStories(opts: { limit: number; hours?: number; category?: CategorySlug; region?: RegionSlug; exclude?: Set<string>; needHero?: boolean }): StoryCard[] {
  const hours = opts.hours ?? 30;
  const where = [visibility(), "s.last_published_at > @since"];
  if (opts.category) where.push("s.category = @category");
  if (opts.region) where.push("s.region = @region");
  if (opts.needHero) where.push("s.hero_image_id IS NOT NULL");
  const rows = db()
    .prepare(`${STORY_SELECT} WHERE ${where.join(" AND ")} ORDER BY s.pinned DESC, s.score DESC LIMIT @lim`)
    .all({ since: Date.now() - hours * 3600_000, category: opts.category ?? null, region: opts.region ?? null, lim: opts.limit * 2 + (opts.exclude?.size ?? 0) + 5 }) as StoryRow[];
  const out = distinctStories(rows.filter((r) => !opts.exclude?.has(r.id))).slice(0, opts.limit);
  for (const r of out) opts.exclude?.add(r.id);
  return cards(out);
}

export function latestStories(opts: { limit: number; offset?: number; category?: CategorySlug; region?: RegionSlug; before?: number }): StoryCard[] {
  const where = [visibility()];
  if (opts.category) where.push("s.category = @category");
  if (opts.region) where.push("s.region = @region");
  if (opts.before) where.push("s.first_published_at < @before");
  const rows = db()
    .prepare(`${STORY_SELECT} WHERE ${where.join(" AND ")} ORDER BY s.first_published_at DESC LIMIT @lim OFFSET @off`)
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

/**
 * „Ultima oră”: subiecte NOI (primul raport în ultimele ore) preluate deja de mai multe redacții,
 * fără nișe (monden, lifestyle, auto). Cele mai noi primele; dacă sunt prea puține, fereastra crește.
 */
export function breakingStories(limit = 8): StoryCard[] {
  const q = db().prepare(
    `${STORY_SELECT} WHERE ${visibility()} AND s.first_published_at > @since AND (s.breaking = 1 OR s.source_count >= @min)
       AND s.category NOT IN ('monden', 'lifestyle', 'auto')
     ORDER BY s.breaking DESC, s.first_published_at DESC LIMIT @lim`
  );
  let rows = q.all({ since: Date.now() - 6 * 3600_000, min: 3, lim: limit * 2 }) as StoryRow[];
  if (rows.length < 3) rows = q.all({ since: Date.now() - 12 * 3600_000, min: 2, lim: limit * 2 }) as StoryRow[];
  return cards(distinctStories(rows).slice(0, limit));
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
  moreInCategory: StoryCard[];
  topics: string[];
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
      `SELECT i.id, i.url, i.title, i.summary, i.published_at, i.thumb_image_id, s.name, s.site FROM items i JOIN sources s ON s.id = i.source_id
       WHERE i.story_id = ? AND i.duplicate_of IS NULL ORDER BY i.published_at`
    )
    .all(id) as { id: string; url: string; title: string; summary: string; published_at: number; thumb_image_id: number | null; name: string; site: string }[];
  // Ore nesigure: ≥3 articole ale aceleiași publicații cu exact același minut (ora colectării, nu a publicării).
  const minuteCount = new Map<string, number>();
  for (const i of items) {
    const k = `${i.name}|${Math.floor(i.published_at / 60_000)}`;
    minuteCount.set(k, (minuteCount.get(k) ?? 0) + 1);
  }
  const leadId = (d.prepare("SELECT lead_item_id FROM stories WHERE id = ?").get(id) as { lead_item_id: string | null } | undefined)?.lead_item_id;
  const sources: SourceChip[] = items.map((i) => ({
    name: i.name,
    site: i.site,
    url: i.url,
    title: i.title,
    published: i.published_at,
    thumb: imageById(i.thumb_image_id),
    lead: i.id === leadId,
    excerpt: excerptOf(i.title, i.summary),
    timeUncertain: (minuteCount.get(`${i.name}|${Math.floor(i.published_at / 60_000)}`) ?? 0) >= 3,
  }));
  const corrections = d.prepare("SELECT text, created_at FROM corrections WHERE story_id = ? ORDER BY created_at").all(id) as { text: string; created_at: number }[];

  // Subiecte legate: cuvinte-cheie comune RARE (un cuvânt care apare în multe subiecte, precum
  // „România” sau „guvern”, nu leagă nimic). Separat: cele mai noi știri din aceeași secțiune.
  const related = relatedStories(id);
  // Trei carduri egale: doar subiecte cu poză, care nu repetă știrea curentă.
  const moreInCategory = distinctStories(
    latestStories({ limit: 20, category: row.category }).filter((c) => c.id !== id && !related.some((r) => r.id === c.id) && ((c.hero && c.hero.kind !== "card") || c.thumb)),
    [card]
  ).slice(0, 3);

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
    moreInCategory,
    // Persoane, instituții și locuri numite în titlurile surselor (legături interne către căutare).
    topics: topicNames(items),
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
      `SELECT s.name, MIN(s.site) AS site, MIN(s.tier) AS tier, GROUP_CONCAT(s.category) AS categories,
              SUM(CASE WHEN s.last_status IN ('200','304') THEN 1 ELSE 0 END) AS ok, COUNT(*) AS feeds, MAX(s.last_fetch_at) AS last_fetch,
              GROUP_CONCAT(CASE WHEN s.last_status NOT IN ('200','304') THEN s.last_error END, '|') AS errors,
              (SELECT COUNT(*) FROM items i JOIN sources x ON x.id = i.source_id WHERE x.name = s.name AND i.fetched_at > ?) AS day
       FROM sources s WHERE s.enabled = 1 GROUP BY s.name ORDER BY s.name COLLATE NOCASE`
    )
    .all(Date.now() - 86400_000) as {
    name: string;
    site: string;
    tier: number;
    categories: string;
    ok: number;
    feeds: number;
    last_fetch: number | null;
    errors: string | null;
    day: number;
  }[];
}

/** Motivul unui flux care nu răspunde, pe înțelesul cititorului. */
export function feedProblem(errors: string | null): string {
  const e = errors ?? "";
  if (/\b429\b/.test(e)) return "limitează temporar accesul";
  if (/\b40[13]\b/.test(e)) return "blochează accesul automat";
  if (/\b404\b|\b410\b/.test(e)) return "flux mutat sau desființat";
  if (/\b5\d\d\b/.test(e)) return "eroare pe serverul publicației";
  if (/timeout|abort/i.test(e)) return "nu răspunde la timp";
  if (/xml|parse|feed/i.test(e)) return "flux invalid";
  return e ? "nu răspunde" : "în așteptarea primei verificări";
}

/**
 * Numele proprii (de cel puțin două cuvinte) din titlurile unui subiect, cele mai frecvente primele.
 * Fără titluri scrise cu majuscule, fără formule de adresare („Domnul Grindeanu”), cu formele
 * gramaticale unite („Guvernului Mureșan” = „Guvernul Mureșan”); la subiectele cu mai multe
 * publicații, numele trebuie să apară la cel puțin două dintre ele.
 */
function topicNames(items: { title: string; name: string }[], max = 6): string[] {
  const seen = new Map<string, { label: string; outlets: Set<string>; n: number }>();
  const outletsTotal = new Set(items.map((i) => i.name)).size;
  for (const it of items) {
    const letters = it.title.replace(/[^A-Za-zĂÂÎȘŞȚŢăâîșşțţ]/g, "");
    if (letters.length > 12 && letters === letters.toUpperCase()) continue;
    for (let n of properNames(it.title)) {
      n = n.replace(/^(Domnul|Doamna|Domnului|Doamnei|Premierul|Premierului|Președintele|Președintelui|Ministrul|Ministrului)\s+/u, "");
      const words = n.split(" ");
      if (words.length < 2 || words.some((w) => /^[A-ZĂÂÎȘŞȚŢ]{2,}$/.test(w) && w.length > 4)) continue;
      const key = words.map((w) => w.toLowerCase().replace(/(ului|ul|ei|lui|ii)$/u, "")).join(" ");
      const cur = seen.get(key) ?? { label: n, outlets: new Set<string>(), n: 0 };
      if (n.length < cur.label.length) cur.label = n; // forma de bază e de obicei cea mai scurtă
      cur.outlets.add(it.name);
      cur.n++;
      seen.set(key, cur);
    }
  }
  return [...seen.values()]
    .filter((x) => outletsTotal < 2 || x.outlets.size >= 2)
    .sort((a, b) => b.outlets.size - a.outlets.size || b.n - a.n)
    .slice(0, max)
    .map((x) => x.label);
}

/** Extrasul unei surse: începutul rezumatului, dacă nu doar repetă titlul. */
function excerptOf(title: string, summary: string): string | undefined {
  // Fără ghilimelele sursei la început/sfârșit (le adaugă pagina).
  const sum = summary.replace(/\s+/g, " ").trim().replace(/^[„"“«»]+|[”"“»«]+$/g, "").trim();
  if (sum.length < 40) return undefined;
  const norm = (x: string) => x.toLowerCase().replace(/[^a-zăâîșțş0-9 ]/g, "").slice(0, 60);
  if (norm(sum).startsWith(norm(title).slice(0, 40))) return undefined;
  return snippet(sum);
}

/**
 * Subiectele cu adevărat legate: din ultimele 4 zile, cu un nume propriu comun și cel puțin 2 cuvinte-cheie comune în titlu care sunt
 * rare în perioada respectivă (ponderate ca IDF), ordonate după scorul de suprapunere.
 */
export function relatedStories(id: string, limit = 4): StoryCard[] {
  const d = db();
  const rows = d
    .prepare(`SELECT s.id, s.title FROM stories s WHERE s.status = 'active' AND s.last_published_at > ?`)
    .all(Date.now() - 4 * 86400_000) as { id: string; title: string }[];
  // Doar titlul principal: subiectele mari adună cuvintele a zeci de titluri și s-ar „lega” de orice.
  const sets = new Map(rows.map((r) => [r.id, new Set(keywords(r.title).filter((k) => k.length >= 4 && !/^\d+$/.test(k)))]));
  // Numele proprii din titlu (fără cele generice: țări, agenții): trebuie să existe cel puțin unul comun.
  const names = new Map(rows.map((r) => [r.id, new Set(entities(r.title).filter((e) => !GENERIC_ENTITIES.has(e)))]));
  const myNames = names.get(id) ?? new Set<string>();
  const mine = sets.get(id);
  if (!mine?.size) return [];
  const df = new Map<string, number>();
  for (const set of sets.values()) for (const k of set) df.set(k, (df.get(k) ?? 0) + 1);
  const N = sets.size;
  const scored: { id: string; score: number; shared: number }[] = [];
  for (const [other, set] of sets) {
    if (other === id) continue;
    let score = 0;
    let shared = 0;
    for (const k of mine) {
      if (!set.has(k)) continue;
      const n = df.get(k) ?? 1;
      if (n > N * 0.03) continue; // prea comun ca să lege două subiecte
      score += Math.log(N / n);
      shared++;
    }
    const sameName = [...(names.get(other) ?? [])].some((e) => myNames.has(e));
    if (sameName && shared >= 2 && score >= 9) scored.push({ id: other, score, shared });
  }
  scored.sort((a, b) => b.score - a.score);
  const ids = scored.slice(0, limit * 2).map((x) => x.id);
  if (!ids.length) return [];
  const cardRows = d.prepare(`${STORY_SELECT} WHERE s.id IN (${ids.map(() => "?").join(",")}) AND ${visibility()}`).all(...ids) as StoryRow[];
  const order = new Map(ids.map((x, i) => [x, i]));
  return cards(cardRows.sort((a, b) => order.get(a.id)! - order.get(b.id)!).slice(0, limit));
}

/**
 * „Unghi mort”: subiecte relatate de cel puțin 4 publicații (în ultimele 48 de ore), pe care un
 * întreg tip de redacții (ex. toate televiziunile active) nu le-a relatat.
 */
export function blindspotStories(limit = 12): { story: StoryCard; blind: GroupKey[]; coverage: Coverage }[] {
  const rows = db()
    .prepare(
      `${STORY_SELECT} WHERE ${visibility()} AND s.last_published_at > @since AND s.first_published_at < @old AND s.source_count >= 4
         AND s.category IN ('national', 'politica', 'economie', 'international')
       ORDER BY s.source_count DESC, s.score DESC LIMIT 150`
    )
    .all({ since: Date.now() - 48 * 3600_000, old: Date.now() - 3 * 3600_000 }) as StoryRow[];
  const out: { story: StoryCard; blind: GroupKey[]; coverage: Coverage }[] = [];
  for (const story of cards(rows)) {
    const coverage = coverageOf(story.category, story.sources.map((x) => x.name), Date.now() - story.published);
    if (coverage.blind.length) out.push({ story, blind: coverage.blind, coverage });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * „Ce trebuie să știi azi”: cele mai relatate subiecte din ultimele 24 de ore, fără nișe, cel mult
 * două pe categorie, cu cel puțin unul internațional dacă există. Ordinea: câte redacții au relatat.
 */
export function briefStories(limit = 7, now = Date.now()): StoryCard[] {
  const rows = db()
    .prepare(
      `${STORY_SELECT} WHERE ${visibility()} AND s.first_published_at > @since AND s.source_count >= 2
         AND s.category NOT IN ('monden', 'lifestyle', 'auto')
       ORDER BY s.source_count DESC, s.score DESC LIMIT 80`
    )
    .all({ since: now - 24 * 3600_000 }) as StoryRow[];
  const pool = distinctStories(rows);
  const perCat = new Map<string, number>();
  const out: StoryRow[] = [];
  for (const r of pool) {
    if ((perCat.get(r.category) ?? 0) >= 2) continue;
    perCat.set(r.category, (perCat.get(r.category) ?? 0) + 1);
    out.push(r);
    if (out.length >= limit) break;
  }
  if (!out.some((r) => r.category === "international")) {
    const intl = pool.find((r) => r.category === "international" && !out.includes(r));
    if (intl) out.splice(Math.min(out.length, limit - 1), 1, intl);
  }
  return cards(out);
}

/** Textul simplu al rezumatului (Telegram, WhatsApp, notificări). */
export function briefText(stories: StoryCard[], siteUrl = config.siteUrl): string {
  const day = new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Bucharest" }).format(Date.now());
  const lines = stories.map((s, i) => `${i + 1}. ${s.title} (${s.sourceCount} publicații)\n${siteUrl}${s.href}`);
  return `Ce trebuie să știi azi, ${day}:\n\n${lines.join("\n\n")}\n\nToate știrile: ${siteUrl}/azi`;
}

/** Cardurile unor subiecte, după ID (ordinea nu e garantată). */
export function storyCards(ids: string[]): StoryCard[] {
  if (!ids.length) return [];
  const rows = db().prepare(`${STORY_SELECT} WHERE s.id IN (${ids.map(() => "?").join(",")}) AND ${visibility()}`).all(...ids) as StoryRow[];
  return cards(rows);
}
