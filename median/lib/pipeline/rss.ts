import { XMLParser } from "fast-xml-parser";
import type { ImageCandidate, ParsedItem } from "../core/types";
import { cleanText, cleanTitle, decodeEntities, fixDiacritics, hashId, stripHtml, truncate } from "../core/utils";

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

/** Cel mai mare candidat dintr-un srcset („a.jpg 300w, b.jpg 1024w”). */
function bestFromSrcset(srcset: string): string | undefined {
  let best: { url: string; w: number } | undefined;
  for (const part of srcset.split(",")) {
    const [url, d] = part.trim().split(/\s+/);
    if (!url || url.startsWith("data:")) continue;
    const w = d ? parseFloat(d) * (d.endsWith("x") ? 1000 : 1) : 0;
    if (!best || w > best.w) best = { url, w };
  }
  return best?.url;
}

/** Toate imaginile candidate dintr-un item RSS; alegerea finală se face în pipeline-ul de imagini. */
function imageCandidates(item: Record<string, unknown>, html: string, base: string): ImageCandidate[] {
  const out: ImageCandidate[] = [];
  const push = (raw: string, from: ImageCandidate["from"], w?: string, h?: string) => {
    const url = absolutize(text(raw), base);
    if (!url || !isLikelyImage(url) || out.some((c) => c.url === url)) return;
    const width = Number(w) || undefined;
    const height = Number(h) || undefined;
    out.push({ url, from, width, height });
  };
  const group = item["media:group"] as Record<string, unknown> | undefined;
  for (const mc of [...arr(item["media:content"]), ...arr(group?.["media:content"])]) {
    const medium = attr(mc, "medium");
    const type = attr(mc, "type");
    if (!medium || medium === "image" || type.startsWith("image")) push(attr(mc, "url"), "rss-media", attr(mc, "width"), attr(mc, "height"));
  }
  for (const mt of [...arr(item["media:thumbnail"]), ...arr(group?.["media:thumbnail"])]) push(attr(mt, "url"), "rss-media", attr(mt, "width"), attr(mt, "height"));
  for (const enc of arr(item["enclosure"])) {
    const type = attr(enc, "type");
    if (!type || type.startsWith("image")) push(attr(enc, "url"), "rss-enclosure");
  }
  const direct = item["image"];
  if (direct) push(typeof direct === "string" ? direct : text((direct as Record<string, unknown>)["url"]) || attr(direct, "url"), "rss-media");
  for (const tag of html.match(IMG_TAG_RE) ?? []) {
    const get = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1];
    const srcset = get("data-srcset") || get("srcset");
    const url = get("data-src") || get("data-lazy-src") || get("data-original") || (srcset && bestFromSrcset(srcset)) || get("src");
    if (!url || url.startsWith("data:") || /(lazy|placeholder|blank|spacer)\.(gif|png|svg)/i.test(url)) continue;
    push(url, "rss-html", get("width"), get("height"));
    if (out.length > 6) break;
  }
  return out;
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
  // Format numeric românesc: „26.09.2026 11:24” / „26-09-2026”.
  const ro = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T,]+(\d{1,2}):(\d{2}))?/.exec(s);
  if (ro) s = `${ro[3]}-${ro[2].padStart(2, "0")}-${ro[1].padStart(2, "0")} ${ro[4] ?? "12"}:${ro[5] ?? "00"}:00`;
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

export function parseFeed(xml: string, site: string, now = Date.now()): ParsedItem[] {
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

  const out: ParsedItem[] = [];
  for (const item of items.slice(0, 80)) {
    const guid = item["guid"];
    const guidLink = guid && attr(guid, "isPermaLink") !== "false" && /^https?:/i.test(text(guid)) ? text(guid) : "";
    const link = absolutize(feed ? atomLink(item) : text(item["link"]) || guidLink, site);
    const title = truncate(cleanText(text(item["title"])), 240);
    if (!link || !title) continue;
    const contentHtml = text(item["content:encoded"]) || text(item["content"]) || "";
    const descHtml = text(item["description"]) || text(item["summary"]) || "";
    const html = decodeMaybeEscaped(contentHtml + " " + descHtml);
    const summarySrc = stripHtml(decodeMaybeEscaped(contentHtml.length > descHtml.length ? contentHtml : descHtml));
    const summary = summarySrc
      .replace(/(Citește|Citeste) (mai mult|tot articolul|și).*$/i, "")
      .replace(/The post .* appeared first on .*$/i, "")
      .trim();
    const parsedDate = parseDate(text(item["pubDate"]) || text(item["published"]) || text(item["updated"]) || text(item["dc:date"]));
    const published = parsedDate || now;
    const author = authorOf(item);
    out.push({
      id: hashId(canonicalLink(link)),
      url: link,
      title: cleanTitle(fixDiacritics(title)),
      summary: summary.slice(0, 6000),
      author: author && author.length < 60 ? author : undefined,
      published: Math.min(published, now + 5 * 60_000),
      dateKnown: parsedDate > 0,
      images: imageCandidates(item, html, site),
    });
  }
  return out;
}

/** Unele feed-uri dublu-escapează HTML-ul din descriere (&lt;p&gt;...). */
function decodeMaybeEscaped(s: string): string {
  return /&lt;\/?[a-z]/i.test(s) ? decodeEntities(s) : s;
}
