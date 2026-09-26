import type dns from "dns";
import dnsCb from "dns";
import dnsP from "dns/promises";
import ipaddr from "ipaddr.js";
import net from "net";
import { Agent, fetch as undiciFetch } from "undici";
import { config } from "../core/config";

/* ------------------------------------------------------------------ protecție SSRF */

/** Orice adresă care nu e „unicast public” (privată, loopback, link-local, IPv4 mapat/NAT64 spre acestea etc.). */
export function isPrivateIp(ip: string): boolean {
  try {
    const addr = ipaddr.process(ip); // convertește ::ffff:a.b.c.d în IPv4
    if (addr.kind() === "ipv6") {
      const parts = (addr as ipaddr.IPv6).parts;
      // ::a.b.c.d (IPv4-compatibil, învechit) și prefixele de traducere spre IPv4
      if (parts.slice(0, 6).every((p) => p === 0)) return true;
    }
    return addr.range() !== "unicast";
  } catch {
    return true;
  }
}

/** Rezolvare DNS care refuză adresele interne chiar în momentul conectării (previne „DNS rebinding”). */
function safeLookup(hostname: string, options: dns.LookupOptions, callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void) {
  dnsCb.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some((a) => isPrivateIp(a.address))) return callback(Object.assign(new Error("adresă internă refuzată"), { code: "EPRIVATE" }), "");
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

let dispatcher: Agent | undefined;
function publicDispatcher(): Agent | undefined {
  if (config.demo || process.env.MEDIAN_ALLOW_PRIVATE === "1") return undefined;
  return (dispatcher ??= new Agent({ connect: { lookup: safeLookup as never } }));
}

/**
 * Refuză URL-urile care duc spre rețele interne (localhost, 10.x, 169.254.x etc.), ca un flux
 * compromis să nu poată folosi serverul pentru a accesa servicii interne. În modul demo/test
 * (rețea simulată pe localhost) verificarea este dezactivată.
 */
export async function assertPublicUrl(raw: string): Promise<void> {
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("protocol nepermis");
  if (config.demo || process.env.MEDIAN_ALLOW_PRIVATE === "1") return;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("adresă internă");
  const addrs = net.isIP(host) ? [{ address: host }] : await dnsP.lookup(host, { all: true });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("adresă internă");
}

export interface FetchResult {
  status: number;
  url: string;
  text: string;
  headers: Headers;
  notModified: boolean;
}

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  etag?: string | null;
  lastModified?: string | null;
  referer?: string;
  accept?: string;
  /** Oprește citirea după </head> (pentru metadate og:image). */
  stopAtHead?: boolean;
}

/**
 * Cerere HTTP robustă: timeout, limită de mărime citită în flux (stream), decodare după charset,
 * cereri condiționate (ETag / If-Modified-Since). Folosim fetch-ul din undici, nu pe cel global
 * (pe care Next.js îl interceptează pentru cache).
 */
export async function httpGet(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12_000);
  try {
    await assertPublicUrl(url);
    const headers: Record<string, string> = {
      "user-agent": config.userAgent,
      accept: opts.accept ?? "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.5",
      "accept-language": "ro-RO,ro;q=0.9,en;q=0.6",
    };
    if (opts.etag) headers["if-none-match"] = opts.etag;
    if (opts.lastModified) headers["if-modified-since"] = opts.lastModified;
    if (opts.referer) headers.referer = opts.referer;
    const res = await safeFetch(url, { signal: ctrl.signal, headers });
    const h = res.headers as unknown as Headers;
    if (res.status === 304) {
      ctrl.abort();
      return { status: 304, url: res.url || url, text: "", headers: h, notModified: true };
    }
    if (!res.ok || !res.body) {
      ctrl.abort();
      throw new HttpError(res.status, `HTTP ${res.status}`);
    }
    const bytes = await readLimited(res.body as unknown as ReadableStream<Uint8Array>, opts.maxBytes ?? 3_000_000, opts.stopAtHead);
    ctrl.abort();
    return { status: res.status, url: res.url || url, text: decode(bytes, h.get("content-type") || ""), headers: h, notModified: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Descarcă un fișier binar (imagini), cu limită de mărime. */
export async function httpGetBuffer(url: string, opts: FetchOptions = {}): Promise<{ buffer: Buffer; contentType: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15_000);
  try {
    await assertPublicUrl(url);
    const headers: Record<string, string> = { "user-agent": config.userAgent, accept: opts.accept ?? "image/avif,image/webp,image/*;q=0.9,*/*;q=0.5" };
    if (opts.referer) headers.referer = opts.referer;
    const res = await safeFetch(url, { signal: ctrl.signal, headers });
    if (!res.ok || !res.body) throw new HttpError(res.status, `HTTP ${res.status}`);
    const bytes = await readLimited(res.body as unknown as ReadableStream<Uint8Array>, opts.maxBytes ?? 12_000_000);
    ctrl.abort();
    return { buffer: Buffer.from(bytes), contentType: res.headers.get("content-type") || "" };
  } finally {
    clearTimeout(timer);
  }
}

/** Urmează manual redirecționările (max. 5), verificând fiecare destinație. */
async function safeFetch(url: string, init: { signal: AbortSignal; headers: Record<string, string> }) {
  let current = url;
  for (let i = 0; i < 6; i++) {
    await assertPublicUrl(current);
    const res = await undiciFetch(current, { ...init, redirect: "manual", dispatcher: publicDispatcher() });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      res.body?.cancel().catch(() => {});
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("prea multe redirecționări");
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function readLimited(body: ReadableStream<Uint8Array>, maxBytes: number, stopAtHead = false): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let tail = "";
  const probe = new TextDecoder("latin1");
  try {
    while (size < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
      if (stopAtHead) {
        const txt = tail + probe.decode(value);
        if (/<\/head>/i.test(txt)) break;
        tail = txt.slice(-16);
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(Math.min(size, maxBytes));
  let off = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.min(c.byteLength, out.byteLength - off));
    out.set(part, off);
    off += part.byteLength;
    if (off >= out.byteLength) break;
  }
  return out;
}

function decode(bytes: Uint8Array, contentType: string): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  let enc = (
    /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ||
    /encoding=["']([\w-]+)["']/i.exec(head)?.[1] ||
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ||
    "utf-8"
  ).toLowerCase();
  // Node nu are ISO-8859-16 (standardul românesc); ISO-8859-2 e cea mai apropiată codificare.
  if (enc === "iso-8859-16") enc = "iso-8859-2";
  try {
    return new TextDecoder(enc).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/* ------------------------------------------------------------------ robots.txt & TDM */

interface RobotsRules {
  disallow: string[];
  allow: string[];
  tdmReserved: boolean;
  fetchedAt: number;
}

const robotsCache = new Map<string, RobotsRules>();

/**
 * Respectăm robots.txt (secțiunile pentru „*” și „MedianBot”) și rezervările TDM
 * (antet TDM-Reservation / fișier /.well-known/tdmrep.json) ale fiecărui site.
 */
export async function isAllowed(url: string): Promise<{ allowed: boolean; reason?: string }> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { allowed: false, reason: "URL invalid" };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { allowed: false, reason: "protocol" };
  const origin = u.origin;
  let rules = robotsCache.get(origin);
  if (!rules || Date.now() - rules.fetchedAt > 12 * 3600_000) {
    rules = { disallow: [], allow: [], tdmReserved: false, fetchedAt: Date.now() };
    try {
      const r = await httpGet(origin + "/robots.txt", { timeoutMs: 6000, maxBytes: 200_000, accept: "text/plain" });
      Object.assign(rules, parseRobots(r.text));
    } catch {
      /* fără robots.txt = permis */
    }
    try {
      const t = await httpGet(origin + "/.well-known/tdmrep.json", { timeoutMs: 5000, maxBytes: 50_000, accept: "application/json" });
      const data = JSON.parse(t.text) as { location?: string; "tdm-reservation"?: number }[];
      if (Array.isArray(data) && data.some((d) => d["tdm-reservation"] === 1 && (!d.location || d.location === "/" || d.location === "/*"))) rules.tdmReserved = true;
    } catch {
      /* fără fișier TDM */
    }
    robotsCache.set(origin, rules);
  }
  if (rules.tdmReserved) return { allowed: false, reason: "rezervare TDM" };
  const p = u.pathname + u.search;
  const longest = (list: string[]) => list.filter((r) => r && matchRobots(p, r)).reduce((m, r) => Math.max(m, r.length), -1);
  if (longest(rules.disallow) > longest(rules.allow)) return { allowed: false, reason: "robots.txt" };
  return { allowed: true };
}

export function parseRobots(txt: string): Pick<RobotsRules, "disallow" | "allow"> {
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([\w-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], allow: [], disallow: [] }));
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (key === "disallow") cur.disallow.push(val);
    else if (key === "allow") cur.allow.push(val);
  }
  const specific = groups.filter((g) => g.agents.some((a) => a.includes("medianbot")));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  return { disallow: chosen.flatMap((g) => g.disallow), allow: chosen.flatMap((g) => g.allow) };
}

function matchRobots(path: string, rule: string): boolean {
  const anchored = rule.endsWith("$");
  const body = rule.replace(/\$$/, "").split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp("^" + body + (anchored ? "$" : "")).test(path);
}
