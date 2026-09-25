import "server-only";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { SOURCES } from "./sources";
import { parseFeed } from "./rss";
import { buildDemoArticles } from "./demo";
import { assignClusters } from "./cluster";
import type { Article, CategorySlug, Cluster, NewsState } from "./types";
import { fetch as undiciFetch } from "undici";
import { decodeEntities } from "./utils";

/** Intervalul de colectare automată: 5 minute. */
export const REFRESH_MS = 5 * 60 * 1000;
const MAX_ARTICLES = 3000;
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const FEED_TIMEOUT_MS = 9000;
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 MedianBot/1.0";

interface Store {
  articles: Map<string, Article>;
  updatedAt: number;
  demo: boolean;
  sourcesOk: number;
  sourceStatus: Record<string, { ok: boolean; count: number; at: number; error?: string; fails?: number }>;
  views: Record<string, number>;
  /** Articole pentru care am căutat deja og:image fără succes (nu le mai descărcăm). */
  noImg: Set<string>;
  /** Momentul ultimei încercări de colectare (reușită sau nu). */
  attemptedAt: number;
  loaded: boolean;
  refreshing: Promise<void> | null;
  sorted: Article[] | null;
  clusters: Map<string, Article[]> | null;
}

const g = globalThis as unknown as { __median?: Store };
const store: Store = (g.__median ??= {
  articles: new Map(),
  updatedAt: 0,
  demo: false,
  sourcesOk: 0,
  sourceStatus: {},
  views: {},
  noImg: new Set(),
  attemptedAt: 0,
  loaded: false,
  refreshing: null,
  sorted: null,
  clusters: null,
});

function dataDir(): string {
  return process.env.MEDIAN_DATA_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), "median") : path.join(process.cwd(), ".cache"));
}

let diskLoad: Promise<void> | null = null;
function loadFromDisk(): Promise<void> {
  if (store.loaded) return Promise.resolve();
  return (diskLoad ??= readDisk().finally(() => {
    store.loaded = true;
  }));
}

async function readDisk() {
  try {
    const raw = await fs.readFile(path.join(dataDir(), "news.json"), "utf8");
    const data = JSON.parse(raw) as { articles: Article[]; updatedAt: number; views?: Record<string, number>; sourceStatus?: Store["sourceStatus"] };
    // Colectarea poate fi rulat deja înainte de citirea de pe disc: nu suprascriem date mai noi.
    if (store.demo && data.articles.length) {
      store.articles.clear();
      store.demo = false;
    }
    for (const a of data.articles) if (!store.articles.has(a.id)) store.articles.set(a.id, a);
    store.updatedAt = Math.max(store.updatedAt, data.updatedAt || 0);
    store.views = { ...(data.views ?? {}), ...store.views };
    store.sourceStatus = { ...(data.sourceStatus ?? {}), ...store.sourceStatus };
    store.sourcesOk = Object.values(store.sourceStatus).filter((s) => s.ok).length;
    invalidate();
  } catch {
    /* primul start — nu există cache pe disc */
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (store.demo) return;
    try {
      const dir = dataDir();
      await fs.mkdir(dir, { recursive: true });
      const tmp = path.join(dir, "news.json.tmp");
      await fs.writeFile(
        tmp,
        JSON.stringify({ updatedAt: store.updatedAt, articles: [...store.articles.values()], views: store.views, sourceStatus: store.sourceStatus })
      );
      await fs.rename(tmp, path.join(dir, "news.json"));
    } catch (e) {
      console.warn("[median] nu am putut salva cache-ul:", (e as Error).message);
    }
  }, 1500);
}

function invalidate() {
  store.sorted = null;
  store.clusters = null;
}

/**
 * Descarcă un URL ca text. Folosim fetch-ul din undici (nu cel global, pe care Next.js
 * îl interceptează pentru cache): colectarea poate rula și în timpul regenerării ISR
 * a unei pagini, iar un fetch „no-store” acolo ar fi transformat de Next într-o eroare.
 * Citirea se oprește după `maxBytes` (sau după </head> pentru paginile HTML).
 */
async function fetchText(url: string, timeout = FEED_TIMEOUT_MS, maxBytes = 3_000_000, stopAtHead = false): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await undiciFetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": UA, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5" },
      redirect: "follow",
    });
    if (!res.ok || !res.body) throw new Error("HTTP " + res.status);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    const probe = new TextDecoder("latin1");
    while (size < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
      if (stopAtHead && /<\/head>/i.test(probe.decode(value))) break;
    }
    ctrl.abort();
    const bytes = new Uint8Array(Math.min(size, maxBytes));
    let off = 0;
    for (const c of chunks) {
      const part = c.subarray(0, Math.min(c.byteLength, bytes.byteLength - off));
      bytes.set(part, off);
      off += part.byteLength;
      if (off >= bytes.byteLength) break;
    }
    const ct = res.headers.get("content-type") || "";
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, 300));
    let enc = (/charset=([\w-]+)/i.exec(ct)?.[1] || /encoding=["']([\w-]+)["']/i.exec(head)?.[1] || "utf-8").toLowerCase();
    // Node nu are ISO-8859-16 (standardul românesc); ISO-8859-2 e cea mai apropiată codificare.
    if (enc === "iso-8859-16") enc = "iso-8859-2";
    try {
      return new TextDecoder(enc).decode(bytes);
    } catch {
      return new TextDecoder("utf-8").decode(bytes);
    }
  } finally {
    clearTimeout(t);
  }
}

async function pool<T>(items: T[], limit: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    })
  );
}

/** Domeniul „principal” (ultimele două etichete), ex. www.digi24.ro -> digi24.ro. */
function rootDomain(host: string): string {
  return host.toLowerCase().split(".").slice(-2).join(".");
}

/** Pentru articolele fără imagine în RSS, încercăm og:image din pagina articolului. */
async function enrichImages(articles: Article[]) {
  const missing = articles
    .filter((a) => !a.image && !store.noImg.has(a.id))
    .sort((a, b) => b.published - a.published)
    .slice(0, 40);
  await pool(missing, 8, async (a) => {
    try {
      // Descărcăm doar pagini de pe domeniul sursei (fără adrese interne sau străine).
      const link = new URL(a.link);
      if (rootDomain(link.hostname) !== rootDomain(new URL(a.sourceSite).hostname)) throw new Error("domeniu străin");
      const html = await fetchText(a.link, 6000, 400_000, true);
      const m =
        /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i.exec(html) ||
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i.exec(html) ||
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i.exec(html);
      const img = m ? new URL(decodeEntities(m[1]), a.link) : null;
      if (img && (img.protocol === "https:" || img.protocol === "http:")) a.image = img.toString().replace(/^http:\/\//, "https://");
      else store.noImg.add(a.id);
    } catch {
      store.noImg.add(a.id);
    }
  });
}

export async function refresh(): Promise<void> {
  if (store.refreshing) return store.refreshing;
  store.refreshing = (async () => {
    await loadFromDisk();
    const now = Date.now();
    store.attemptedAt = now;
    let ok = 0;
    const fresh: Article[] = [];
    // Sursele care au eșuat de 3 ori la rând sunt reîncercate doar o dată la 30 de minute.
    const due = SOURCES.filter((s) => {
      const st = store.sourceStatus[s.id];
      return !st || st.ok || (st.fails ?? 0) < 3 || now - st.at > 30 * 60_000;
    });
    await pool(due, 12, async (src) => {
      try {
        const xml = await fetchText(src.url);
        const items = parseFeed(xml, src, now);
        if (!items.length) throw new Error("feed gol sau invalid");
        ok++;
        store.sourceStatus[src.id] = { ok: true, count: items.length, at: now };
        fresh.push(...items);
      } catch (e) {
        const fails = (store.sourceStatus[src.id]?.fails ?? 0) + 1;
        store.sourceStatus[src.id] = { ok: false, count: 0, at: now, error: (e as Error).message?.slice(0, 120), fails };
      }
    });

    if (ok === 0 && (store.articles.size === 0 || store.demo)) {
      // Nicio sursă accesibilă (ex. mediu fără internet) — afișăm conținut demonstrativ.
      store.demo = true;
      for (const a of buildDemoArticles(now)) store.articles.set(a.id, a);
    } else if (ok > 0) {
      if (store.demo) {
        store.articles.clear();
        store.demo = false;
      }
      // Același articol poate veni din fluxul general și din cel de secțiune: păstrăm categoria specifică.
      const byId = new Map<string, Article>();
      for (const a of fresh) {
        const other = byId.get(a.id);
        if (!other || (other.category === "national" && a.category !== "national")) byId.set(a.id, a);
      }
      for (const a of byId.values()) {
        const prev = store.articles.get(a.id);
        if (prev) {
          if (a.category === "national" && prev.category !== "national") {
            a.category = prev.category;
            a.sourceId = prev.sourceId;
          }
          // Păstrăm prima dată de publicare și eventuala imagine găsită anterior.
          a.published = Math.min(prev.published, a.published);
          a.image = a.image || prev.image;
          a.fetched = prev.fetched;
        }
        store.articles.set(a.id, a);
      }
      // Căutarea imaginilor lipsă e limitată la 8 secunde ca să nu întârzie colectarea.
      await Promise.race([
        enrichImages([...byId.keys()].map((id) => store.articles.get(id)!).filter((a) => !a.image)),
        new Promise((r) => setTimeout(r, 8000)),
      ]);
      // Curățenie: articole prea vechi și limită de dimensiune.
      const all = [...store.articles.values()].sort((a, b) => b.published - a.published);
      for (const a of all.slice(MAX_ARTICLES)) store.articles.delete(a.id);
      for (const a of all) if (now - a.published > MAX_AGE_MS) store.articles.delete(a.id);
      for (const id of Object.keys(store.views)) if (!store.articles.has(id)) delete store.views[id];
      for (const id of store.noImg) if (!store.articles.has(id)) store.noImg.delete(id);
    }
    store.sourcesOk = ok;
    // „Actualizat acum” doar dacă am primit efectiv știri (sau suntem în modul demo).
    if (ok > 0 || store.demo) store.updatedAt = now;
    invalidate();
    scheduleSave();
    console.log(`[median] colectare: ${ok}/${SOURCES.length} surse, ${fresh.length} articole, total ${store.articles.size}`);
  })().finally(() => {
    store.refreshing = null;
  });
  return store.refreshing;
}

async function ensureFresh() {
  await loadFromDisk();
  const stale = Date.now() - Math.max(store.updatedAt, store.attemptedAt) > REFRESH_MS;
  if (store.articles.size === 0) await refresh();
  else if (stale) {
    // Avem date vechi: așteptăm colectarea cel mult 12 secunde, apoi servim ce avem.
    // (Pe serverless nu ne putem baza pe lucru în fundal după răspuns.)
    await Promise.race([refresh(), new Promise((r) => setTimeout(r, 12_000))]);
  }
}

function sorted(): Article[] {
  if (!store.sorted) {
    const list = [...store.articles.values()].sort((a, b) => b.published - a.published);
    store.clusters = assignClusters(list);
    store.sorted = list;
  }
  return store.sorted;
}

export async function getState(): Promise<NewsState> {
  await ensureFresh();
  return {
    articles: sorted(),
    updatedAt: store.updatedAt,
    demo: store.demo,
    sourcesOk: store.sourcesOk,
    sourcesTotal: SOURCES.length,
  };
}

export async function getArticles(opts: { category?: CategorySlug; limit?: number; since?: number; source?: string } = {}) {
  const { articles } = await getState();
  let list = articles;
  if (opts.category) list = list.filter((a) => a.category === opts.category);
  if (opts.source) list = list.filter((a) => a.sourceId === opts.source);
  if (opts.since) list = list.filter((a) => a.fetched > opts.since!);
  return opts.limit ? list.slice(0, opts.limit) : list;
}

export async function getArticle(id: string): Promise<Article | undefined> {
  await ensureFresh();
  return store.articles.get(id);
}

export function getCluster(a: Article): Article[] {
  if (!store.clusters) sorted();
  return (a.clusterId && store.clusters?.get(a.clusterId)) || [a];
}

/** Grupuri de știri (același subiect relatat de mai multe surse), ordonate după importanță. */
export async function getClusters(opts: { category?: CategorySlug; limit?: number; hours?: number } = {}): Promise<Cluster[]> {
  const { articles } = await getState();
  const now = Date.now();
  const horizon = now - (opts.hours ?? 24) * 3600_000;
  const seen = new Set<string>();
  const clusters: Cluster[] = [];
  for (const a of articles) {
    if (a.published < horizon) break;
    if (opts.category && a.category !== opts.category) continue;
    const key = a.clusterId ?? a.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const members = getCluster(a);
    const withImg = members.find((m) => m.image) ?? a;
    const lead = a.image ? a : { ...a, image: withImg.image };
    clusters.push({ id: key, lead, articles: members, sources: [...new Set(members.map((m) => m.sourceName))] });
  }
  const score = (c: Cluster) => {
    const ageH = (now - c.lead.published) / 3600_000;
    return (c.sources.length * 2 + (c.lead.image ? 1.5 : 0) + 1) / Math.pow(ageH + 2, 0.9);
  };
  clusters.sort((a, b) => score(b) - score(a));
  return opts.limit ? clusters.slice(0, opts.limit) : clusters;
}

export async function search(q: string, limit = 60): Promise<Article[]> {
  const { articles } = await getState();
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const terms = norm(q).split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  const scored: { a: Article; s: number }[] = [];
  for (const a of articles) {
    const t = norm(a.title);
    const body = norm(a.summary);
    let s = 0;
    for (const term of terms) {
      if (t.includes(term)) s += 3;
      else if (body.includes(term)) s += 1;
      else {
        s = 0;
        break;
      }
    }
    if (s > 0) scored.push({ a, s: s + (a.published / 1e13) });
  }
  return scored.sort((x, y) => y.s - x.s).slice(0, limit).map((x) => x.a);
}

const viewSeen = new Set<string>();

/** Înregistrează o vizualizare; fiecare vizitator (după IP) contează o singură dată per articol. */
export function recordView(id: string, visitor = "") {
  if (!store.articles.has(id)) return;
  const key = visitor + ":" + id;
  if (viewSeen.has(key)) return;
  if (viewSeen.size > 50_000) viewSeen.clear();
  viewSeen.add(key);
  store.views[id] = (store.views[id] ?? 0) + 1;
  scheduleSave();
}

export async function getMostRead(limit = 10): Promise<{ articles: Article[]; byViews: boolean }> {
  const { articles } = await getState();
  const dayAgo = Date.now() - 36 * 3600_000;
  const viewed = articles.filter((a) => a.published > dayAgo && (store.views[a.id] ?? 0) > 0);
  const totalViews = viewed.reduce((s, a) => s + (store.views[a.id] ?? 0), 0);
  if (viewed.length >= limit && totalViews >= 25) {
    return { articles: viewed.sort((a, b) => (store.views[b.id] ?? 0) - (store.views[a.id] ?? 0)).slice(0, limit), byViews: true };
  }
  // Fără suficiente date de trafic: cele mai mediatizate subiecte (relatate de cele mai multe surse).
  const clusters = await getClusters({ hours: 24 });
  const top = [...clusters].sort((a, b) => b.sources.length - a.sources.length || b.lead.published - a.lead.published);
  return { articles: top.slice(0, limit).map((c) => c.lead), byViews: false };
}

export function getSourceStatus() {
  return store.sourceStatus;
}
