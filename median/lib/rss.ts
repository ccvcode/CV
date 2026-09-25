import { XMLParser } from "fast-xml-parser";
import type { Article, Source } from "./types";
import { cleanText, decodeEntities, fixDiacritics, hashId, readingTime, slugify, stripHtml, truncate } from "./utils";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: false,
  processEntities: false,
  htmlEntities: false,
  trimValues: true,
  parseTagValue: false,
  isArray: (name) => ["item", "entry", "media:content", "media:thumbnail", "enclosure", "link", "category"].includes(name),
});

type Node = Record<string, unknown> | string | undefined;

function text(n: unknown): string {
  if (n == null) return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return text(n[0]);
  if (typeof n === "object") {
    const o = n as Record<string, unknown>;
    if ("#text" in o) return text(o["#text"]);
    if ("@_href" in o) return text(o["@_href"]);
  }
  return "";
}

function arr<T = Record<string, unknown>>(n: unknown): T[] {
  if (n == null) return [];
  return (Array.isArray(n) ? n : [n]) as T[];
}

function attr(n: unknown, a: string): string {
  if (n && typeof n === "object" && !Array.isArray(n)) return text((n as Record<string, unknown>)["@_" + a]);
  return "";
}

const IMG_TAG_RE = /<img\b[^>]*>/gi;
const LAZY_ATTRS = ["data-src", "data-lazy-src", "data-original", "data-srcset", "srcset", "src"];

/** Prima imagine reală din HTML — preferăm atributele lazy-load față de placeholder-ul din „src”. */
function firstImg(html: string): string | undefined {
  for (const tag of html.match(IMG_TAG_RE) ?? []) {
    for (const attrName of LAZY_ATTRS) {
      const m = new RegExp(`\\s${attrName}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag);
      if (!m) continue;
      const url = m[1].trim().split(/\s+/)[0];
      if (!url || url.startsWith("data:") || /(lazy|placeholder|blank|spacer)\.(gif|png|svg)/i.test(url)) continue;
      return url;
    }
  }
  return undefined;
}

function absolutize(url: string, base: string): string {
  if (!url) return "";
  url = decodeEntities(url.trim());
  if (url.startsWith("//")) return "https:" + url;
  try {
    const u = new URL(url, base);
    // Acceptăm doar http(s) — protecție împotriva link-urilor „javascript:” sau „data:” din feed-uri.
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}

function isLikelyImage(url: string): boolean {
  if (!url) return false;
  if (/\.(mp3|mp4|m4a|webm|pdf)(\?|$)/i.test(url)) return false;
  if (/(pixel|tracking|feedburner|gravatar|emoji|1x1|spacer)/i.test(url)) return false;
  return true;
}

function extractImage(item: Record<string, unknown>, html: string, base: string): string | undefined {
  const candidates: string[] = [];
  const group = item["media:group"] as Record<string, unknown> | undefined;
  for (const mc of [...arr(item["media:content"]), ...arr(group?.["media:content"])]) {
    const medium = attr(mc, "medium");
    const type = attr(mc, "type");
    if (!medium || medium === "image" || type.startsWith("image")) candidates.push(attr(mc, "url"));
  }
  for (const mt of [...arr(item["media:thumbnail"]), ...arr(group?.["media:thumbnail"])]) candidates.push(attr(mt, "url"));
  for (const enc of arr(item["enclosure"])) {
    const type = attr(enc, "type");
    if (!type || type.startsWith("image")) candidates.push(attr(enc, "url"));
  }
  const itunes = item["itunes:image"];
  if (itunes) candidates.push(attr(itunes, "href"));
  const direct = item["image"];
  if (direct) candidates.push(typeof direct === "string" ? direct : text((direct as Record<string, unknown>)["url"]) || attr(direct, "url"));
  const inline = firstImg(html);
  if (inline) candidates.push(inline);
  for (const c of candidates) {
    const u = absolutize(text(c), base);
    if (u && isLikelyImage(u)) return u.replace(/^http:\/\//, "https://");
  }
  return undefined;
}

const RO_MONTHS: Record<string, string> = {
  ian: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", mai: "May", iun: "Jun",
  iul: "Jul", aug: "Aug", sep: "Sep", oct: "Oct", noi: "Nov", dec: "Dec",
};

/** Decalajul Europe/Bucharest față de UTC (în minute) la momentul dat. */
function bucharestOffset(ts: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Bucharest", hourCycle: "h23",
    year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric",
  }).formatToParts(ts);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return (Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - Math.floor(ts / 60000) * 60000) / 60000;
}

function parseDate(raw: string): number {
  if (!raw) return 0;
  let s = raw.trim();
  // Zile și luni în română („Joi, 14 noiembrie 2023”) -> engleză.
  s = s.replace(/^(luni|marți|marti|miercuri|joi|vineri|sâmbătă|sambata|duminică|duminica|lun|mar|mie|joi|vin|sâm|sam|dum)\b\.?,?\s*/i, "");
  s = s.replace(/\b(ian|feb|mar|apr|mai|iun|iul|aug|sep|oct|noi|dec)[a-zăâîșţț]*\.?/gi, (m, k: string) => RO_MONTHS[k.toLowerCase()] ?? m);
  const hasZone = /(Z|[+-]\d{2}:?\d{2}|\b(GMT|UTC|EET|EEST|[ECMP][SD]T))\s*$/i.test(s);
  const t = Date.parse(s);
  if (Number.isNaN(t)) return 0;
  // Fără fus orar explicit: presupunem ora României, nu ora serverului.
  if (!hasZone) {
    let asUtc = Date.parse(s + " UTC");
    if (Number.isNaN(asUtc)) asUtc = Date.parse(s.replace(" ", "T") + "Z");
    if (Number.isNaN(asUtc)) return t;
    return asUtc - bucharestOffset(asUtc) * 60000;
  }
  return t;
}

const TRACKING = /^(utm_\w+|fbclid|gclid|mc_cid|mc_eid|ref|ocid|cmpid|_ga)$/i;

/** Link canonic pentru ID: fără fragment și fără parametri de tracking, dar păstrând restul query-ului. */
function canonicalLink(link: string): string {
  try {
    const u = new URL(link);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    u.searchParams.sort();
    return u.toString().replace(/\?$/, "");
  } catch {
    return link;
  }
}

function authorOf(item: Record<string, unknown>): string {
  const raw = text(item["dc:creator"]) || text((item["author"] as Record<string, unknown>)?.["name"]) || text(item["author"]);
  // RSS <author> are adesea forma „email@site.ro (Nume Prenume)”.
  const m = /\(([^)]+)\)/.exec(raw);
  return cleanText(m ? m[1] : raw.includes("@") ? "" : raw);
}

function atomLink(entry: Record<string, unknown>): string {
  const links = arr(entry["link"]);
  const alt = links.find((l) => typeof l === "object" && (!attr(l, "rel") || attr(l, "rel") === "alternate"));
  return attr(alt ?? links[0], "href") || text(links[0]);
}

export function parseFeed(xml: string, source: Source, now = Date.now()): Article[] {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  const rss = doc["rss"] as Record<string, Node> | undefined;
  const rdf = doc["rdf:RDF"] as Record<string, Node> | undefined;
  const feed = doc["feed"] as Record<string, Node> | undefined;
  const channel = (rss?.["channel"] ?? rdf?.["channel"]) as Record<string, unknown> | undefined;
  const items: Record<string, unknown>[] = feed
    ? arr(feed["entry"])
    : arr((channel?.["item"] as unknown) ?? rdf?.["item"]);

  const out: Article[] = [];
  for (const item of items.slice(0, 60)) {
    const guid = item["guid"];
    const guidLink = guid && attr(guid, "isPermaLink") !== "false" && /^https?:/i.test(text(guid)) ? text(guid) : "";
    const link = absolutize(feed ? atomLink(item) : text(item["link"]) || guidLink, source.site);
    const title = truncate(cleanText(text(item["title"])), 220);
    if (!link || !title) continue;
    const contentHtml = text(item["content:encoded"]) || text(item["content"]) || "";
    const descHtml = text(item["description"]) || text(item["summary"]) || "";
    const html = decodeMaybeEscaped(contentHtml || descHtml);
    const summarySrc = stripHtml(decodeMaybeEscaped(descHtml || contentHtml));
    const summary = truncate(summarySrc.replace(/\s+/g, " ").replace(/(Citește|Citeste) (mai mult|tot articolul).*$/i, "").replace(/The post .* appeared first on .*$/i, "").trim(), 420);
    const content = contentHtml ? truncate(stripHtml(decodeMaybeEscaped(contentHtml)), 1600) : undefined;
    const published =
      parseDate(text(item["pubDate"]) || text(item["published"]) || text(item["updated"]) || text(item["dc:date"])) || now;
    const image = extractImage(item, html, source.site);
    const author = authorOf(item) || undefined;
    out.push({
      id: hashId(canonicalLink(link)),
      slug: slugify(title, 70),
      title: fixDiacritics(title),
      summary: summary === title ? "" : summary,
      content: content && content.length > summary.length + 80 ? content : undefined,
      link,
      image,
      published: Math.min(published, now + 5 * 60_000),
      fetched: now,
      sourceId: source.id,
      sourceName: source.name,
      sourceSite: source.site,
      category: source.category,
      author: author && author.length < 60 ? author : undefined,
      readingTime: readingTime((content ?? summary) + " " + title),
    });
  }
  return out;
}

/** Unele feed-uri dublu-escapează HTML-ul din descriere (&lt;p&gt;...). */
function decodeMaybeEscaped(s: string): string {
  return /&lt;\/?[a-z]/i.test(s) ? decodeEntities(s) : s;
}
