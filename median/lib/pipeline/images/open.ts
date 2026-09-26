import { config } from "../../core/config";
import { HttpError, httpGet } from "../http";

/*
 * Imagini cu licență liberă pentru poza principală a articolelor:
 *  - Wikidata (proprietatea P18 = imaginea oficială a unei persoane/instituții/localități) și
 *    Wikimedia Commons (căutare), doar cu licențe CC0 / domeniu public / CC BY / CC BY-SA;
 *  - Unsplash și Pexels (necesită chei gratuite) pentru subiecte generale.
 */

export interface OpenImage {
  kind: "commons" | "unsplash" | "pexels";
  url: string;
  /** Pentru imaginile servite direct de la furnizor (Unsplash/Pexels): șablon de URL cu lățime. */
  sizedUrl?: (w: number) => string;
  width: number;
  height: number;
  credit: string;
  creditUrl: string;
  license: string;
  licenseUrl?: string;
  title?: string;
  color?: string;
  /** Unsplash cere apelarea acestui URL când o poză este folosită. */
  downloadLocation?: string;
}

const ALLOWED_LICENSE = /^(cc0|cc[- ]?zero|public domain|pd|cc[- ]by(-sa)?[- ]?\d(\.\d)?|cc[- ]by(-sa)?)/i;

/** Cererile către API-uri trec prin același client HTTP ca restul (protecție SSRF, proxy, limită de mărime). */
async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const wikimedia = /(^|\.)(wikidata|wikimedia)\.org$/.test(new URL(url).hostname);
  // Politica Wikimedia pentru roboți: User-Agent cu nume, site și adresă de contact.
  if (wikimedia) headers = { "user-agent": `MedianBot/2.0 (${config.siteUrl}; ${config.contactEmail})`, ...headers };
  const get = () => httpGet(url, { timeoutMs: 12_000, maxBytes: 4_000_000, accept: "application/json", headers });
  if (!wikimedia) return JSON.parse((await get()).text) as T;
  // Wikimedia cere cereri secvențiale de la roboți: le trimitem pe rând, cu o pauză scurtă între ele,
  // și reîncercăm de cel mult două ori după o limitare (HTTP 429), cât cere antetul Retry-After.
  const run = wikimediaQueue.then(async () => {
    for (let attempt = 0; ; attempt++) {
      const wait = lastWikimedia + 250 - Date.now();
      if (wait > 0) await sleep(wait);
      lastWikimedia = Date.now();
      try {
        return JSON.parse((await get()).text) as T;
      } catch (e) {
        if (attempt >= 2 || !(e instanceof HttpError) || e.status !== 429) throw e;
        await sleep(Math.min(60, e.retryAfterSec ?? 5) * 1000);
      }
    }
  });
  wikimediaQueue = run.catch(() => undefined);
  return run;
}

let wikimediaQueue: Promise<unknown> = Promise.resolve();
let lastWikimedia = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const foldName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const strip = (s?: string) => (s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

interface CommonsPage {
  title: string;
  imageinfo?: {
    url: string;
    thumburl?: string;
    width: number;
    height: number;
    thumbwidth?: number;
    thumbheight?: number;
    descriptionurl: string;
    extmetadata?: Record<string, { value: string }>;
  }[];
}

function fromCommonsPage(p: CommonsPage): OpenImage | undefined {
  const ii = p.imageinfo?.[0];
  if (!ii) return undefined;
  const md = ii.extmetadata ?? {};
  const license = strip(md.LicenseShortName?.value);
  if (!ALLOWED_LICENSE.test(license)) return undefined;
  if (ii.width < 1000) return undefined;
  const ratio = ii.width / ii.height;
  if (ratio < 0.6 || ratio > 2.6) return undefined;
  const artist = strip(md.Artist?.value) || "autor necunoscut";
  return {
    kind: "commons",
    url: ii.thumburl ?? ii.url,
    width: ii.thumbwidth ?? ii.width,
    height: ii.thumbheight ?? ii.height,
    credit: `Foto: ${artist.slice(0, 80)} / Wikimedia Commons / ${license}`,
    creditUrl: ii.descriptionurl,
    license,
    licenseUrl: strip(md.LicenseUrl?.value) || undefined,
    title: [p.title.replace(/^File:/, "").replace(/\.\w+$/, ""), strip(md.ImageDescription?.value).slice(0, 300)].filter(Boolean).join(" — "),
  };
}

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

async function commonsFiles(titles: string[]): Promise<OpenImage[]> {
  if (!titles.length) return [];
  const q = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    titles: titles.map((t) => (t.startsWith("File:") ? t : "File:" + t)).join("|"),
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1600",
  });
  const data = await getJson<{ query?: { pages?: CommonsPage[] } }>(`${COMMONS_API}?${q}`);
  return (data.query?.pages ?? []).map(fromCommonsPage).filter((x): x is OpenImage => Boolean(x));
}

/** Imaginea oficială (P18) a unei entități din Wikidata, căutată după nume în română. */
export async function wikidataImage(name: string): Promise<OpenImage | undefined> {
  if (!config.images.commons) return undefined;
  // Aceeași persoană apare în multe subiecte: ținem minte rezultatul câteva ore.
  const key = foldName(name);
  const hit = wikidataCache.get(key);
  if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.img;
  const img = await wikidataLookup(name);
  wikidataCache.set(key, { img, at: Date.now() });
  if (wikidataCache.size > 2000) wikidataCache.delete(wikidataCache.keys().next().value!);
  return img;
}

const wikidataCache = new Map<string, { img: OpenImage | undefined; at: number }>();

async function wikidataLookup(name: string): Promise<OpenImage | undefined> {
  const s = new URLSearchParams({ action: "wbsearchentities", format: "json", language: "ro", uselang: "ro", type: "item", limit: "3", search: name });
  const found = await getJson<{ search?: { id: string; label?: string; description?: string; match?: { text?: string } }[] }>(`https://www.wikidata.org/w/api.php?${s}`);
  // Doar entitățile al căror nume corespunde exact (altfel riscăm poza altei persoane cu nume asemănător).
  const want = foldName(name);
  const ids = (found.search ?? []).filter((x) => [x.label, x.match?.text].some((l) => l && foldName(l) === want)).map((x) => x.id).slice(0, 2);
  if (!ids.length) return undefined;
  const e = new URLSearchParams({ action: "wbgetentities", format: "json", ids: ids.join("|"), props: "claims" });
  const ents = await getJson<{ entities?: Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: string } } }[]> }> }>(
    `https://www.wikidata.org/w/api.php?${e}`
  );
  for (const id of ids) {
    const file = ents.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (!file) continue;
    const [img] = await commonsFiles([file]);
    if (img) return img;
  }
  return undefined;
}

/** Căutare de fotografii pe Wikimedia Commons. */
export async function commonsSearch(query: string, limit = 6): Promise<OpenImage[]> {
  if (!config.images.commons || !query.trim()) return [];
  const q = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: "6",
    gsrlimit: String(limit),
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1600",
  });
  const data = await getJson<{ query?: { pages?: CommonsPage[] } }>(`${COMMONS_API}?${q}`);
  return (data.query?.pages ?? []).map(fromCommonsPage).filter((x): x is OpenImage => Boolean(x));
}

/** Unsplash: imaginile se afișează direct de pe serverele Unsplash (obligatoriu conform regulilor API). */
export async function unsplashSearch(query: string): Promise<OpenImage[]> {
  const key = config.images.unsplashKey;
  if (!key || !query.trim()) return [];
  const q = new URLSearchParams({ query, orientation: "landscape", per_page: "10", content_filter: "high" });
  const data = await getJson<{
    results?: {
      id: string;
      width: number;
      height: number;
      color?: string;
      urls: { raw: string };
      links: { html: string; download_location: string };
      user: { name: string; links: { html: string } };
      alt_description?: string;
    }[];
  }>(`https://api.unsplash.com/search/photos?${q}`, { authorization: `Client-ID ${key}`, "accept-version": "v1" });
  const utm = "utm_source=median&utm_medium=referral";
  return (data.results ?? []).map((r) => ({
    kind: "unsplash" as const,
    url: r.urls.raw,
    sizedUrl: (w: number) => `${r.urls.raw}&w=${w}&fit=crop&crop=entropy&q=75&fm=webp&ar=16:9`,
    width: r.width,
    height: r.height,
    color: r.color,
    credit: `Foto: ${r.user.name} / Unsplash`,
    creditUrl: `${r.links.html}?${utm}`,
    license: "Unsplash License",
    licenseUrl: `https://unsplash.com/license?${utm}`,
    title: r.alt_description,
    downloadLocation: r.links.download_location,
  }));
}

export async function pexelsSearch(query: string): Promise<OpenImage[]> {
  const key = config.images.pexelsKey;
  if (!key || !query.trim()) return [];
  const q = new URLSearchParams({ query, orientation: "landscape", per_page: "10" });
  const data = await getJson<{
    photos?: { id: number; width: number; height: number; avg_color?: string; url: string; photographer: string; photographer_url: string; alt?: string; src: { original: string } }[];
  }>(`https://api.pexels.com/v1/search?${q}`, { authorization: key });
  return (data.photos ?? []).map((p) => ({
    kind: "pexels" as const,
    url: p.src.original,
    sizedUrl: (w: number) => `${p.src.original}?auto=compress&cs=tinysrgb&fit=crop&w=${w}&h=${Math.round((w * 9) / 16)}`,
    width: p.width,
    height: p.height,
    color: p.avg_color,
    credit: `Foto: ${p.photographer} / Pexels`,
    creditUrl: p.url,
    license: "Pexels License",
    licenseUrl: "https://www.pexels.com/license/",
    title: p.alt,
  }));
}

/** Notificarea obligatorie către Unsplash când folosim o poză. */
export async function unsplashTrackDownload(downloadLocation: string) {
  const key = config.images.unsplashKey;
  if (!key) return;
  try {
    await getJson(downloadLocation, { authorization: `Client-ID ${key}`, "accept-version": "v1" });
  } catch {
    /* nu blocăm publicarea */
  }
}
