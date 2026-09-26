/*
 * Server HTTP pentru rețeaua de știri SIMULATĂ (fără dependențe în afară de node:http și sharp
 * pentru imagini). Pornire:  npx tsx scripts/demo-network/server.ts [port=4010]
 *
 *   /                                  index (publicații și fluxuri)
 *   /robots.txt                        permite tot, cu excepția /techzona/articol/
 *   /<publicație>/                     prima pagină
 *   /<publicație>/feed.xml             flux principal (RSS 2.0 sau Atom)
 *   /<publicație>/feed/<secțiune>.xml  flux de secțiune (unde există)
 *   /<publicație>/articol/<slug>       pagina articolului
 *   /<publicație>/img/<fișier>.jpg     imagini generate (cache în .cache/)
 *   /<publicație>/robots.txt           robots.txt relativ la publicație
 *   /_control/add-breaking             injectează o știre de ultimă oră în fluxurile a două publicații
 *   /_control/sources.json             sursele în formatul lib/core/types.ts `Source`
 *
 * Datele de publicare sunt calculate relativ la momentul pornirii, deci conținutul pare mereu proaspăt.
 */
import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { pathToFileURL } from "node:url";
import type { CategorySlug } from "../../lib/core/types";
import {
  BREAKING_STORIES,
  OUTLETS,
  STORIES,
  outletById,
  quoteOf,
  slugify,
  type ImageSpec,
  type Outlet,
  type OutletSection,
  type Story,
  type StoryVersion,
} from "./content";
import { DEFAULT_OG, FULL, TINY, ensureArticleImage, ensureDefaultImage, readImage } from "./images";
import { demoSources, type DemoSource } from "./sources";

export type ImageMode = "normal" | "default" | "og-only" | "tiny";

export interface DemoArticle {
  key: string;
  numId: number;
  story: Story;
  version: StoryVersion;
  outlet: Outlet;
  slug: string;
  published: number;
  modified: number;
  imageMode: ImageMode;
  image: ImageSpec;
  breaking?: boolean;
}

const CATEGORY_LABEL: Record<CategorySlug, string> = {
  national: "Actualitate",
  politica: "Politică",
  economie: "Economie",
  international: "Externe",
  sport: "Sport",
  tech: "Tehnologie",
  lifestyle: "Lifestyle",
  sanatate: "Sănătate",
  auto: "Auto",
  cultura: "Cultură",
  monden: "Monden",
};

/* ------------------------------------------------------------------ utilitare */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const RO_DAYS = ["duminică", "luni", "marți", "miercuri", "joi", "vineri", "sâmbătă"];
const RO_MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

/** Componentele datei în ora României + decalajul față de UTC. */
function bucharestParts(ts: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Bucharest", hourCycle: "h23",
    year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", weekday: "short",
  }).formatToParts(ts);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const n = (t: string) => Number(g(t));
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  const offsetMin = Math.round((asUtc - Math.floor(ts / 1000) * 1000) / 60000);
  const dow = new Date(asUtc).getUTCDay();
  return { y: n("year"), mo: n("month"), d: n("day"), h: n("hour"), mi: n("minute"), s: n("second"), offsetMin, dow };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Formatul de dată din fluxul fiecărei publicații (variat intenționat). */
function feedDate(outlet: Outlet, ts: number): string {
  switch (outlet.id) {
    case "stiricarpatice":
    case "sporttotal":
    case "mondenplus":
      return new Date(ts).toUTCString().replace("GMT", "+0000"); // stil WordPress
    case "jurnaluldevest": {
      const p = bucharestParts(ts);
      const sign = p.offsetMin >= 0 ? "+" : "-";
      const off = Math.abs(p.offsetMin);
      const en = new Date(Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s)).toUTCString().replace(" GMT", "");
      return `${en} ${sign}${pad(Math.floor(off / 60))}${pad(off % 60)}`;
    }
    case "infoest": {
      // Dată în română, fără fus orar (ora locală) — apare în fluxuri reale mai vechi.
      const p = bucharestParts(ts);
      return `${RO_DAYS[p.dow]}, ${p.d} ${RO_MONTHS[p.mo - 1]} ${p.y} ${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`;
    }
    default:
      return new Date(ts).toUTCString();
  }
}

function isoLocal(ts: number): string {
  const p = bucharestParts(ts);
  const sign = p.offsetMin >= 0 ? "+" : "-";
  const off = Math.abs(p.offsetMin);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}${sign}${pad(Math.floor(off / 60))}:${pad(off % 60)}`;
}

function displayDate(ts: number): string {
  const p = bucharestParts(ts);
  return `${p.d} ${RO_MONTHS[p.mo - 1]} ${p.y}, ${pad(p.h)}:${pad(p.mi)}`;
}

/* ------------------------------------------------------------------ rețeaua */

export class DemoNetwork {
  readonly startedAt: number;
  readonly articles: DemoArticle[] = [];
  private breakingCount = 0;
  private bySlug = new Map<string, DemoArticle>();

  constructor(readonly baseUrl: string, startedAt = Date.now()) {
    this.startedAt = startedAt;
    let i = 0;
    for (const story of STORIES) {
      for (const version of story.versions) {
        // Distribuție deterministă a modurilor de imagine: ~15% implicită, ~10% doar og:image, ~5% minusculă.
        const bucket = (i * 37) % 100;
        const mode: ImageMode = bucket < 15 ? "default" : bucket < 25 ? "og-only" : bucket < 30 ? "tiny" : "normal";
        this.add(story, version, startedAt - version.offsetMin * 60_000, mode);
        i++;
      }
    }
  }

  private add(story: Story, version: StoryVersion, published: number, imageMode: ImageMode, breaking = false, suffix = ""): DemoArticle {
    const outlet = outletById(version.outlet);
    const key = `${story.id}--${outlet.id}${suffix}`;
    const numId = 1_000_000 + (hash32(key) % 8_999_999);
    const slug = `${slugify(version.title, 80)}-${numId}`;
    const h = hash32(key + "m");
    const art: DemoArticle = {
      key,
      numId,
      story,
      version,
      outlet,
      slug,
      published,
      // Unele articole sunt actualizate după publicare.
      modified: h % 3 === 0 ? Math.min(published + (5 + (h % 90)) * 60_000, Math.max(published, this.startedAt)) : published,
      imageMode,
      image: { ...story.image, ...version.image, hue: version.image?.hue ?? (story.image.hue ?? 0) + (h % 40) - 20 },
      breaking,
    };
    this.articles.push(art);
    this.bySlug.set(`${outlet.id}/${slug}`, art);
    return art;
  }

  /** Adaugă următoarea știre de ultimă oră în fluxurile celor două publicații care o relatează. */
  addBreaking(now = Date.now()): DemoArticle[] {
    const story = BREAKING_STORIES[this.breakingCount % BREAKING_STORIES.length];
    const round = Math.floor(this.breakingCount / BREAKING_STORIES.length);
    this.breakingCount++;
    const suffix = round ? `-${round + 1}` : "";
    return story.versions.map((v, idx) =>
      this.add({ ...story, id: story.id + suffix }, v, now - (story.versions.length - 1 - idx) * 3 * 60_000, "normal", true, suffix)
    );
  }

  /** Generează din timp toate imaginile (în cache pe disc), secvențial. */
  async warmImages(): Promise<number> {
    let n = 0;
    for (const o of OUTLETS) {
      await ensureDefaultImage(o);
      n++;
    }
    for (const a of [...this.articles]) {
      await ensureArticleImage(a.key, a.image, a.outlet, "full");
      await ensureArticleImage(a.key, a.image, a.outlet, "tiny");
      n += 2;
    }
    return n;
  }

  sources(): DemoSource[] {
    return demoSources(this.baseUrl);
  }

  outletArticles(outlet: Outlet, section?: OutletSection, now = Date.now()): DemoArticle[] {
    return this.articles
      .filter((a) => a.outlet.id === outlet.id && a.published <= now + 60_000)
      .filter((a) => !section?.includes || section.includes.includes(a.story.category))
      .sort((a, b) => b.published - a.published);
  }

  find(outletId: string, slug: string): DemoArticle | undefined {
    return this.bySlug.get(`${outletId}/${slug}`);
  }

  /* ---------------------------------------------------------------- URL-uri */

  outletUrl(o: Outlet): string {
    return `${this.baseUrl}/${o.id}`;
  }
  articleUrl(a: DemoArticle): string {
    return `${this.outletUrl(a.outlet)}/articol/${a.slug}`;
  }
  /** Imaginea „principală” a articolului conform modului (null = nu are imagine proprie). */
  imageFor(a: DemoArticle): { url: string; width: number; height: number; isDefault: boolean } {
    const base = `${this.outletUrl(a.outlet)}/img`;
    if (a.imageMode === "default") return { url: `${base}/default-og.jpg`, ...DEFAULT_OG, isDefault: true };
    if (a.imageMode === "tiny") return { url: `${base}/${a.slug}-300x169.jpg`, ...TINY, isDefault: false };
    return { url: `${base}/${a.slug}.jpg`, ...FULL, isDefault: false };
  }
  /** Imaginea din flux (lipsește pentru modul „og-only”). */
  feedImage(a: DemoArticle) {
    return a.imageMode === "og-only" ? undefined : this.imageFor(a);
  }
  credit(a: DemoArticle): string {
    const h = hash32(a.key + "c") % 4;
    return h === 0 ? `Foto: ${a.version.author} / ${a.outlet.name}` : h === 1 ? `Foto: Arhivă ${a.outlet.name}` : h === 2 ? "Foto: Agenția Foto Demo" : `Sursa foto: ${a.outlet.name}`;
  }

  /* ---------------------------------------------------------------- fluxuri */

  feed(outlet: Outlet, section: OutletSection, now = Date.now()): { body: string; type: string; lastModified: number } {
    const items = this.outletArticles(outlet, section, now);
    const lastModified = Math.max(this.startedAt - 30 * 3600_000, ...items.map((a) => a.modified));
    const feedUrl = `${this.outletUrl(outlet)}/${section.path}`;
    const title = section.includes ? `${outlet.name} – ${CATEGORY_LABEL[section.category]}` : outlet.name;
    if (outlet.feedFormat === "atom") return { body: this.atom(outlet, items, feedUrl, title, lastModified), type: "application/atom+xml; charset=utf-8", lastModified };

    const wp = outlet.template === "wordpress";
    const out: string[] = [];
    out.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    out.push(
      `<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:sy="http://purl.org/rss/1.0/modules/syndication/">`
    );
    out.push(`<channel>`);
    out.push(`<title>${esc(title)}</title>`);
    out.push(`<atom:link href="${esc(feedUrl)}" rel="self" type="application/rss+xml" />`);
    out.push(`<link>${esc(this.outletUrl(outlet))}/</link>`);
    out.push(`<description>${esc(outlet.tagline)}</description>`);
    out.push(`<lastBuildDate>${feedDate(outlet, lastModified)}</lastBuildDate>`);
    out.push(`<language>ro-RO</language>`);
    if (wp) out.push(`<sy:updatePeriod>hourly</sy:updatePeriod><sy:updateFrequency>1</sy:updateFrequency><generator>https://wordpress.org/?v=6.6.2</generator>`);
    out.push(`<image><url>${esc(this.outletUrl(outlet))}/img/default-og.jpg</url><title>${esc(outlet.name)}</title><link>${esc(this.outletUrl(outlet))}/</link></image>`);
    for (const a of items) out.push(this.rssItem(a));
    out.push(`</channel></rss>`);
    return { body: out.join("\n"), type: "application/rss+xml; charset=utf-8", lastModified };
  }

  private rssItem(a: DemoArticle): string {
    const o = a.outlet;
    const url = this.articleUrl(a);
    const img = this.feedImage(a);
    const lead = a.version.paragraphs[0];
    const wp = o.template === "wordpress";
    const parts: string[] = ["<item>"];
    parts.push(`<title>${esc(a.version.title)}</title>`);
    parts.push(`<link>${esc(url)}</link>`);
    if (wp) parts.push(`<comments>${esc(url)}#respond</comments>`);
    parts.push(`<pubDate>${feedDate(o, a.published)}</pubDate>`);
    if (wp) parts.push(`<dc:creator>${cdata(a.version.author)}</dc:creator>`);
    else parts.push(`<author>redactia@${o.domain} (${esc(a.version.author)})</author>`);
    parts.push(`<category>${cdata(CATEGORY_LABEL[a.story.category])}</category>`);
    parts.push(wp ? `<guid isPermaLink="false">${esc(this.outletUrl(o))}/?p=${a.numId}</guid>` : `<guid isPermaLink="true">${esc(url)}</guid>`);

    switch (o.feedFormat) {
      case "rss-enclosure": {
        const tail = wp ? `<p>The post <a href="${esc(url)}">${esc(a.version.title)}</a> appeared first on <a href="${esc(this.outletUrl(o))}">${esc(o.name)}</a>.</p>` : "";
        parts.push(`<description>${cdata(`<p>${esc(truncateWords(lead, 40))} [&#8230;]</p>${tail}`)}</description>`);
        if (img) parts.push(`<enclosure url="${esc(img.url)}" length="${120_000 + (a.numId % 90_000)}" type="image/jpeg" />`);
        break;
      }
      case "rss-media": {
        parts.push(`<description>${cdata(`<p>${esc(lead)}</p>`)}</description>`);
        if (img) {
          parts.push(
            `<media:content url="${esc(img.url)}" medium="image" type="image/jpeg" width="${img.width}" height="${img.height}"><media:title type="plain">${esc(a.image.caption)}</media:title><media:credit>${esc(this.credit(a))}</media:credit></media:content>`
          );
          if (o.id === "actualitateatv") parts.push(`<media:thumbnail url="${esc(img.url)}?w=320" width="320" height="180" />`);
        }
        break;
      }
      case "rss-html": {
        const lazy = o.id !== "magazincultural";
        const imgTag = img
          ? lazy
            ? `<figure class="wp-caption"><img class="lazyload" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" data-src="${esc(img.url)}" data-srcset="${esc(img.url)}?w=768 768w, ${esc(img.url)} ${img.width}w" width="${img.width}" height="${img.height}" alt="${esc(a.image.caption)}" /><figcaption>${esc(a.image.caption)}</figcaption></figure>`
            : `<p><img src="${esc(img.url)}" alt="${esc(a.image.caption)}" width="${img.width}" height="${img.height}" /></p>`
          : "";
        const body = a.version.paragraphs.slice(0, 3).map((p) => `<p>${esc(p)}</p>`).join("");
        parts.push(`<description>${cdata(esc(truncateWords(lead, 35)) + " Citește mai mult...")}</description>`);
        parts.push(`<content:encoded>${cdata(imgTag + body + `<p><a href="${esc(url)}">Citește tot articolul</a></p>`)}</content:encoded>`);
        break;
      }
    }
    parts.push("</item>");
    return parts.join("");
  }

  private atom(outlet: Outlet, items: DemoArticle[], feedUrl: string, title: string, lastModified: number): string {
    const out: string[] = [];
    out.push(`<?xml version="1.0" encoding="utf-8"?>`);
    out.push(`<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xml:lang="ro">`);
    out.push(`<title>${esc(title)}</title><subtitle>${esc(outlet.tagline)}</subtitle>`);
    out.push(`<link rel="alternate" type="text/html" href="${esc(this.outletUrl(outlet))}/"/>`);
    out.push(`<link rel="self" type="application/atom+xml" href="${esc(feedUrl)}"/>`);
    out.push(`<id>tag:${outlet.domain},2026:feed</id><updated>${isoLocal(lastModified)}</updated>`);
    for (const a of items) {
      const url = this.articleUrl(a);
      const img = this.feedImage(a);
      const html =
        (img ? `<p><img src="${img.url}" alt="${esc(a.image.caption)}" /></p>` : "") + a.version.paragraphs.slice(0, 2).map((p) => `<p>${esc(p)}</p>`).join("");
      out.push(
        `<entry><title type="html">${esc(a.version.title)}</title><link rel="alternate" type="text/html" href="${esc(url)}"/><id>tag:${outlet.domain},2026:articol-${a.numId}</id>` +
          `<published>${isoLocal(a.published)}</published><updated>${isoLocal(a.modified)}</updated><author><name>${esc(a.version.author)}</name></author>` +
          `<category term="${esc(CATEGORY_LABEL[a.story.category])}"/><summary type="text">${esc(a.version.paragraphs[0])}</summary>` +
          `<content type="html">${esc(html)}</content>` +
          (img ? `<media:thumbnail url="${esc(img.url)}" width="${img.width}" height="${img.height}"/>` : "") +
          `</entry>`
      );
    }
    out.push(`</feed>`);
    return out.join("\n");
  }

  /* ---------------------------------------------------------------- pagini */

  related(a: DemoArticle, n: number): DemoArticle[] {
    const all = this.outletArticles(a.outlet).filter((x) => x.key !== a.key);
    const same = all.filter((x) => x.story.category === a.story.category);
    return [...same, ...all.filter((x) => !same.includes(x))].slice(0, n);
  }

  articlePage(a: DemoArticle): string {
    return a.outlet.template === "wordpress" ? this.wordpressPage(a) : this.newsroomPage(a);
  }

  private head(a: DemoArticle, extra: string): string {
    const o = a.outlet;
    const url = this.articleUrl(a);
    const img = this.imageFor(a);
    const desc = truncateWords(a.version.paragraphs[0], 30);
    return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(a.version.title)} | ${esc(o.name)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="author" content="${esc(a.version.author)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:locale" content="ro_RO">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(o.name)}">
<meta property="og:title" content="${esc(a.version.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img.url)}">
<meta property="og:image:width" content="${img.width}">
<meta property="og:image:height" content="${img.height}">
<meta property="og:image:type" content="image/jpeg">
<meta property="article:published_time" content="${isoLocal(a.published)}">
<meta property="article:modified_time" content="${isoLocal(a.modified)}">
<meta property="article:section" content="${esc(CATEGORY_LABEL[a.story.category])}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(img.url)}">
<link rel="icon" href="/${o.id}/img/default-og.jpg">
${extra}
<style>
body{margin:0;font-family:Georgia,serif;color:#222;background:#fafafa}
header.site,.site-header{background:${o.color};color:#fff;padding:12px 24px}
.site-header a,header.site a{color:#fff;margin-right:12px;text-decoration:none}
main{max-width:1100px;margin:0 auto;padding:16px;display:flex;gap:32px}
article{flex:1;max-width:760px}
aside{width:300px}
img{max-width:100%;height:auto}
.ad{background:#eee;color:#999;text-align:center;font:12px sans-serif;padding:40px 0;margin:16px 0}
.citeste-si,.related-inline{border-left:4px solid ${o.accent};padding:8px 12px;background:#fff;margin:16px 0}
.newsletter-box{background:${o.color};color:#fff;padding:16px;margin:24px 0}
figcaption{font:13px sans-serif;color:#666}
</style>
</head>`;
  }

  private nav(o: Outlet): string {
    const cats = o.sections.length > 1 || o.sections[0].category === "national" ? Object.entries(CATEGORY_LABEL).slice(0, 7) : [[o.sections[0].category, CATEGORY_LABEL[o.sections[0].category]]];
    return cats.map(([slug, label]) => `<a href="/${o.id}/categorie/${slug}/">${esc(label)}</a>`).join("");
  }

  private figureHtml(a: DemoArticle, lazy: boolean): string {
    if (a.imageMode === "default") return ""; // redacția nu a pus o fotografie proprie
    const img = this.imageFor(a);
    const src = lazy
      ? `src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3C/svg%3E" data-src="${esc(img.url)}" data-srcset="${esc(img.url)}?w=768 768w, ${esc(img.url)} ${img.width}w" class="lazyload wp-post-image"`
      : `src="${esc(img.url)}" srcset="${esc(img.url)}?w=768 768w, ${esc(img.url)} ${img.width}w" sizes="(max-width: 760px) 100vw, 760px" class="wp-post-image"`;
    return `<figure class="wp-block-image size-large post-thumbnail">
<img ${src} width="${img.width}" height="${img.height}" alt="${esc(a.image.caption)}" decoding="async">${lazy ? `<noscript><img src="${esc(img.url)}" alt="${esc(a.image.caption)}"></noscript>` : ""}
<figcaption>${esc(a.image.caption)}. ${esc(this.credit(a))}</figcaption>
</figure>`;
  }

  private wordpressPage(a: DemoArticle): string {
    const o = a.outlet;
    const url = this.articleUrl(a);
    const img = this.imageFor(a);
    const lazy = o.feedFormat === "rss-html";
    const rel = this.related(a, 4);
    const yoast = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", "@id": url, url, name: `${a.version.title} | ${o.name}`, datePublished: isoLocal(a.published), inLanguage: "ro-RO" },
        {
          "@type": "Article",
          "@id": `${url}#article`,
          headline: a.version.title,
          author: { "@type": "Person", name: a.version.author },
          datePublished: isoLocal(a.published),
          dateModified: isoLocal(a.modified),
          image: { "@type": "ImageObject", url: img.url, width: img.width, height: img.height },
          articleSection: [CATEGORY_LABEL[a.story.category]],
          publisher: { "@type": "Organization", name: o.name, logo: { "@type": "ImageObject", url: `${this.outletUrl(o)}/img/default-og.jpg` } },
        },
      ],
    };
    const body: string[] = [];
    a.version.paragraphs.forEach((p, i) => {
      if (i === 2 && a.version.subheading) body.push(`<h2 class="wp-block-heading">${esc(a.version.subheading)}</h2>`);
      body.push(`<p>${esc(p)}</p>`);
      if (i === 1 && rel[0]) body.push(`<div class="citeste-si"><strong>Citește și:</strong> <a href="${esc(this.articleUrl(rel[0]))}">${esc(rel[0].version.title)}</a></div>`);
      if (i === 2) body.push(`<div class="ad ad-inarticle" id="div-gpt-ad-inarticle-1" data-ad-slot="/2134/${o.id}/inarticle">Publicitate</div>`);
      if (i === 3 && rel[1] && a.version.paragraphs.length > 4) body.push(`<p><strong>Citește și: <a href="${esc(this.articleUrl(rel[1]))}">${esc(rel[1].version.title)}</a></strong></p>`);
    });
    const tags = tagsFor(a);
    return `${this.head(a, `<script type="application/ld+json" class="yoast-schema-graph">${JSON.stringify(yoast)}</script>`)}
<body class="post-template-default single single-post postid-${a.numId} single-format-standard">
<div id="page" class="site">
<header id="masthead" class="site-header"><div class="site-branding"><a class="site-title" href="/${o.id}/" rel="home">${esc(o.name)}</a></div><nav id="site-navigation" class="main-navigation">${this.nav(o)}</nav></header>
<div class="ad ad-top" id="div-gpt-ad-billboard">Publicitate</div>
<main id="primary" class="site-main">
<article id="post-${a.numId}" class="post-${a.numId} post type-post status-publish format-standard has-post-thumbnail hentry category-${a.story.category}">
<header class="entry-header">
<span class="cat-links"><a href="/${o.id}/categorie/${a.story.category}/" rel="category tag">${esc(CATEGORY_LABEL[a.story.category])}</a></span>
<h1 class="entry-title">${esc(a.version.title)}</h1>
<div class="entry-meta"><span class="byline">de <span class="author vcard"><a class="url fn n" href="/${o.id}/autor/${slugify(a.version.author)}/">${esc(a.version.author)}</a></span></span> <span class="posted-on"><time class="entry-date published" datetime="${isoLocal(a.published)}">${displayDate(a.published)}</time>${a.modified !== a.published ? ` <time class="updated" datetime="${isoLocal(a.modified)}">Actualizat: ${displayDate(a.modified)}</time>` : ""}</span></div>
</header>
<div class="share-bar"><span>Distribuie:</span> <a class="share-facebook" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}">Facebook</a> <a class="share-x" href="https://x.com/intent/tweet?url=${encodeURIComponent(url)}">X</a> <a class="share-whatsapp" href="https://wa.me/?text=${encodeURIComponent(url)}">WhatsApp</a> <button class="copy-link">Copiază linkul</button></div>
${this.figureHtml(a, lazy)}
<div class="entry-content">
${body.join("\n")}
<div class="newsletter-box"><h3>Abonează-te la newsletterul ${esc(o.name)}</h3><p>Primești în fiecare dimineață cele mai importante știri ale zilei.</p><form action="/${o.id}/newsletter" method="post"><input type="email" name="email" placeholder="Adresa ta de email"><button type="submit">Mă abonez</button></form></div>
<p><em>Urmărește ${esc(o.name)} și pe Google News.</em></p>
</div>
<footer class="entry-footer"><span class="tags-links">Etichete: ${tags.map((t) => `<a href="/${o.id}/tag/${slugify(t)}/" rel="tag">${esc(t)}</a>`).join(", ")}</span></footer>
</article>
<section class="related-posts"><h3>Articole similare</h3><ul>${rel
      .slice(1, 4)
      .map((r) => `<li><a href="${esc(this.articleUrl(r))}"><img src="${esc(this.outletUrl(o))}/img/${r.slug}-300x169.jpg" width="300" height="169" alt="" loading="lazy"> ${esc(r.version.title)}</a></li>`)
      .join("")}</ul></section>
<div id="comments" class="comments-area"><div id="respond" class="comment-respond"><h3 class="comment-reply-title">Lasă un comentariu</h3><p>Adresa ta de email nu va fi publicată.</p></div></div>
<aside id="secondary" class="widget-area"><section class="widget"><h2 class="widget-title">Cele mai citite</h2><ol>${this.outletArticles(o)
      .slice(0, 5)
      .map((r) => `<li><a href="${esc(this.articleUrl(r))}">${esc(r.version.title)}</a></li>`)
      .join("")}</ol></section><div class="ad ad-sidebar">Publicitate</div></aside>
</main>
<footer id="colophon" class="site-footer"><p>© ${new Date(this.startedAt).getFullYear()} ${esc(o.name)}. Toate drepturile rezervate. <a href="/${o.id}/politica-de-confidentialitate/">Politica de confidențialitate</a> · <a href="/${o.id}/contact/">Contact</a></p><p>Publicație fictivă din rețeaua demo Median.</p></footer>
</div>
<div class="cookie-banner" role="dialog">Acest site folosește cookie-uri pentru a-ți oferi o experiență mai bună. <button>Accept</button> <button>Setări</button></div>
<script>/* lazyload stub */document.querySelectorAll("img[data-src]").forEach(function(i){i.src=i.dataset.src});</script>
</body>
</html>`;
  }

  private newsroomPage(a: DemoArticle): string {
    const o = a.outlet;
    const url = this.articleUrl(a);
    const img = this.imageFor(a);
    const rel = this.related(a, 4);
    const q = quoteOf(a.version);
    const ld = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      headline: a.version.title,
      description: truncateWords(a.version.paragraphs[0], 30),
      articleBody: a.version.paragraphs.join("\n\n"),
      articleSection: CATEGORY_LABEL[a.story.category],
      inLanguage: "ro",
      datePublished: isoLocal(a.published),
      dateModified: isoLocal(a.modified),
      author: [{ "@type": "Person", name: a.version.author, url: `${this.outletUrl(o)}/autor/${slugify(a.version.author)}` }],
      publisher: { "@type": "Organization", name: o.name, url: this.outletUrl(o), logo: { "@type": "ImageObject", url: `${this.outletUrl(o)}/img/default-og.jpg`, width: 1200, height: 630 } },
      image: { "@type": "ImageObject", url: img.url, width: img.width, height: img.height },
      keywords: tagsFor(a).join(", "),
    };
    const [lead, ...rest] = a.version.paragraphs;
    const body: string[] = [];
    rest.forEach((p, i) => {
      if (i === 1 && a.version.subheading) body.push(`<h2>${esc(a.version.subheading)}</h2>`);
      body.push(`<p>${esc(p)}</p>`);
      if (i === 0) body.push(`<div class="ad ad-inarticle" data-ad-slot="${o.id}_inread_1"><span>Publicitate</span></div>`);
      if (i === 1 && rel[0]) body.push(`<div class="related-inline"><span>Citește și:</span> <a href="${esc(this.articleUrl(rel[0]))}">${esc(rel[0].version.title)}</a></div>`);
    });
    const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Acasă", item: `${this.outletUrl(o)}/` },
      { "@type": "ListItem", position: 2, name: CATEGORY_LABEL[a.story.category], item: `${this.outletUrl(o)}/stiri/${a.story.category}` },
    ] };
    return `${this.head(a, `<script type="application/ld+json">${JSON.stringify(ld)}</script>\n<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`)}
<body class="page-article">
<div class="ad-wrapper ad-sticky-top"><div class="ad ad-billboard" data-ad-slot="${o.id}_billboard">Publicitate</div></div>
<header class="site"><div class="logo"><a href="/${o.id}/"><strong>${esc(o.name)}</strong></a></div><nav class="menu">${this.nav(o)}</nav><div class="live-bar"><span class="live">LIVE</span> <a href="/${o.id}/live">Urmărește ${esc(o.name)} în direct</a></div></header>
<main class="container">
<article class="article" itemscope itemtype="https://schema.org/NewsArticle">
<div class="breadcrumbs"><a href="/${o.id}/">Acasă</a> / <a href="/${o.id}/stiri/${a.story.category}">${esc(CATEGORY_LABEL[a.story.category])}</a></div>
<h1 class="article-title" itemprop="headline">${a.breaking ? '<span class="badge-breaking">Ultima oră</span> ' : ""}${esc(a.version.title)}</h1>
<div class="article-meta"><span class="author" itemprop="author">Autor: <a href="/${o.id}/autor/${slugify(a.version.author)}">${esc(a.version.author)}</a></span> <time itemprop="datePublished" datetime="${isoLocal(a.published)}">${displayDate(a.published)}</time>${a.modified !== a.published ? ` <span class="updated">Actualizat: <time itemprop="dateModified" datetime="${isoLocal(a.modified)}">${displayDate(a.modified)}</time></span>` : ""}</div>
${
  a.imageMode === "default"
    ? ""
    : `<figure class="article-thumb"><img src="${esc(img.url)}" alt="${esc(a.image.caption)}" width="${img.width}" height="${img.height}" itemprop="image"><figcaption><span class="caption">${esc(a.image.caption)}</span> <span class="credit">${esc(this.credit(a))}</span></figcaption></figure>`
}
<div class="article-intro"><p><strong>${esc(lead)}</strong></p></div>
<div class="data-app-meta data-app-meta-article article-content" itemprop="articleBody">
${body.join("\n")}
</div>
${q ? `<aside class="quote-card"><blockquote>„${esc(q.text)}”</blockquote><cite>${esc(q.speaker)}</cite></aside>` : ""}
<div class="article-tags">${tagsFor(a).map((t) => `<a href="/${o.id}/tag/${slugify(t)}">#${esc(t)}</a>`).join(" ")}</div>
<div class="social-share"><a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}">Distribuie pe Facebook</a> <a href="https://x.com/intent/tweet?url=${encodeURIComponent(url)}">Distribuie pe X</a></div>
<div class="ad ad-after-article" data-ad-slot="${o.id}_after">Publicitate</div>
<section class="more-news"><h3>Alte știri ${esc(CATEGORY_LABEL[a.story.category])}</h3>${rel
      .slice(1)
      .map((r) => `<div class="card"><a href="${esc(this.articleUrl(r))}"><img src="${esc(this.outletUrl(o))}/img/${r.slug}-300x169.jpg" alt="" width="300" height="169" loading="lazy"><h4>${esc(r.version.title)}</h4></a></div>`)
      .join("")}</section>
</article>
<aside class="sidebar"><div class="ad ad-sidebar">Publicitate</div><div class="widget-latest"><h3>Ultimele știri</h3><ul>${this.outletArticles(o)
      .slice(0, 6)
      .map((r) => `<li><time>${displayDate(r.published).split(", ")[1]}</time> <a href="${esc(this.articleUrl(r))}">${esc(r.version.title)}</a></li>`)
      .join("")}</ul></div></aside>
</main>
<footer class="site-footer"><p>${esc(o.name)} © ${new Date(this.startedAt).getFullYear()} · <a href="/${o.id}/despre">Despre noi</a> · <a href="/${o.id}/termeni">Termeni și condiții</a> · <a href="/${o.id}/cookies">Politica cookies</a></p><p>Publicație fictivă din rețeaua demo Median.</p></footer>
<div id="gdpr-consent" class="consent-overlay">Folosim cookie-uri și tehnologii similare. <button>Sunt de acord</button></div>
</body>
</html>`;
  }

  outletHome(o: Outlet): string {
    const items = this.outletArticles(o);
    return `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><title>${esc(o.name)} – ${esc(o.tagline)}</title>
<link rel="alternate" type="${o.feedFormat === "atom" ? "application/atom+xml" : "application/rss+xml"}" title="${esc(o.name)}" href="${esc(this.outletUrl(o))}/feed.xml">
<meta property="og:image" content="${esc(this.outletUrl(o))}/img/default-og.jpg"></head>
<body><h1>${esc(o.name)}</h1><p>${esc(o.tagline)} — publicație fictivă (rețea demo).</p><ul>${items
      .map((a) => `<li><a href="${esc(this.articleUrl(a))}">${esc(a.version.title)}</a> <small>${displayDate(a.published)}</small></li>`)
      .join("")}</ul></body></html>`;
  }

  index(): string {
    return `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><title>Rețea demo Median</title></head><body>
<h1>Rețea de știri simulată (demo)</h1><p>Publicații și persoane fictive. Pornit la ${new Date(this.startedAt).toISOString()}.</p>
<ul>${OUTLETS.map(
      (o) => `<li><a href="/${o.id}/">${esc(o.name)}</a> (${o.domain}, ${o.feedFormat}, ${o.template}) — ${o.sections.map((s) => `<a href="/${o.id}/${s.path}">${s.path}</a>`).join(", ")}</li>`
    ).join("")}</ul>
<p><a href="/_control/add-breaking">/_control/add-breaking</a> · <a href="/_control/sources.json">/_control/sources.json</a></p></body></html>`;
  }

  robots(outletId?: string): string {
    if (outletId) return outletById(outletId as Outlet["id"]).disallowArticles ? "User-agent: *\nDisallow: /articol/\n" : "User-agent: *\nAllow: /\n";
    const lines = ["User-agent: *"];
    for (const o of OUTLETS) if (o.disallowArticles) lines.push(`Disallow: /${o.id}/articol/`);
    lines.push("Disallow: /_control/", "Allow: /", "", "User-agent: GPTBot", "Disallow: /", "");
    return lines.join("\n");
  }
}

function truncateWords(s: string, n: number): string {
  const w = s.split(/\s+/);
  return w.length <= n ? s : w.slice(0, n).join(" ").replace(/[,;:]$/, "");
}

function tagsFor(a: DemoArticle): string[] {
  const tags = [CATEGORY_LABEL[a.story.category]];
  const q = a.version.quoteBy;
  if (q) tags.push(q);
  for (const w of ["București", "Cluj-Napoca", "Iași", "Timișoara", "Arad", "Guvernul", "BNR", "UE", "NATO", "Ucraina", "Republica Moldova", "SUA", "Prahova", "Vrancea"])
    if (a.version.paragraphs.join(" ").includes(w) && tags.length < 5) tags.push(w);
  return tags;
}

/* ------------------------------------------------------------------ HTTP */

function etagOf(body: string | Buffer): string {
  return `W/"${createHash("sha1").update(body).digest("hex").slice(0, 20)}"`;
}

function sendText(req: IncomingMessage, res: ServerResponse, status: number, type: string, body: string, opts: { lastModified?: number; maxAge?: number } = {}) {
  const etag = etagOf(body);
  const headers: Record<string, string> = {
    "Content-Type": type,
    ETag: etag,
    "Cache-Control": `public, max-age=${opts.maxAge ?? 60}`,
    "X-Demo-Network": "1",
  };
  if (opts.lastModified) headers["Last-Modified"] = new Date(opts.lastModified).toUTCString();
  if (status === 200 && isNotModified(req, etag, opts.lastModified)) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  res.writeHead(status, { ...headers, "Content-Length": String(Buffer.byteLength(body)) });
  res.end(req.method === "HEAD" ? undefined : body);
}

function isNotModified(req: IncomingMessage, etag: string, lastModified?: number): boolean {
  const inm = req.headers["if-none-match"];
  if (inm) return inm.split(",").some((t) => t.trim() === etag || t.trim() === "*" || t.trim().replace(/^W\//, "") === etag.replace(/^W\//, ""));
  const ims = req.headers["if-modified-since"];
  if (ims && lastModified) {
    const t = Date.parse(ims);
    if (!Number.isNaN(t) && Math.floor(lastModified / 1000) <= Math.floor(t / 1000)) return true;
  }
  return false;
}

function notFound(req: IncomingMessage, res: ServerResponse) {
  sendText(req, res, 404, "text/html; charset=utf-8", "<!DOCTYPE html><html lang=\"ro\"><head><meta charset=\"utf-8\"><title>Pagina nu a fost găsită</title></head><body><h1>404</h1><p>Pagina nu a fost găsită.</p></body></html>");
}

export function createHandler(net: DemoNetwork) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const u = new URL(req.url ?? "/", "http://x");
      const p = decodeURIComponent(u.pathname);
      if (p === "/" || p === "/index.html") return sendText(req, res, 200, "text/html; charset=utf-8", net.index());
      if (p === "/robots.txt") return sendText(req, res, 200, "text/plain; charset=utf-8", net.robots(), { maxAge: 3600 });
      if (p === "/_control/add-breaking") {
        const added = net.addBreaking();
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        res.end(JSON.stringify({ added: added.map((a) => ({ outlet: a.outlet.id, title: a.version.title, url: net.articleUrl(a), published: new Date(a.published).toISOString() })) }, null, 2));
        return;
      }
      if (p === "/_control/sources.json") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify(net.sources(), null, 2));
        return;
      }
      const m = /^\/([a-z0-9]+)(\/.*)?$/.exec(p);
      const outlet = m && OUTLETS.find((o) => o.id === m[1]);
      if (!m || !outlet) return notFound(req, res);
      const rest = m[2] ?? "/";
      if (rest === "/" || rest === "") return sendText(req, res, 200, "text/html; charset=utf-8", net.outletHome(outlet));
      if (rest === "/robots.txt") return sendText(req, res, 200, "text/plain; charset=utf-8", net.robots(outlet.id), { maxAge: 3600 });
      const section = outlet.sections.find((s) => `/${s.path}` === rest);
      if (section) {
        const f = net.feed(outlet, section);
        return sendText(req, res, 200, f.type, f.body, { lastModified: f.lastModified, maxAge: 300 });
      }
      const art = /^\/articol\/([a-z0-9-]+)\/?$/.exec(rest);
      if (art) {
        const a = net.find(outlet.id, art[1]);
        if (!a) return notFound(req, res);
        return sendText(req, res, 200, "text/html; charset=utf-8", net.articlePage(a), { lastModified: a.modified });
      }
      const img = /^\/img\/([a-z0-9-]+)\.jpg$/.exec(rest);
      if (img) {
        let file: string | undefined;
        if (img[1] === "default-og") file = await ensureDefaultImage(outlet);
        else {
          const tiny = img[1].endsWith("-300x169");
          const a = net.find(outlet.id, tiny ? img[1].slice(0, -8) : img[1]);
          if (a) file = await ensureArticleImage(a.key, a.image, outlet, tiny ? "tiny" : "full");
        }
        if (!file) return notFound(req, res);
        const buf = await readImage(file);
        const etag = etagOf(buf);
        const headers = { "Content-Type": "image/jpeg", ETag: etag, "Cache-Control": "public, max-age=86400" };
        if (isNotModified(req, etag)) {
          res.writeHead(304, headers);
          return res.end();
        }
        res.writeHead(200, { ...headers, "Content-Length": String(buf.length) });
        return res.end(req.method === "HEAD" ? undefined : buf);
      }
      return notFound(req, res);
    } catch (err) {
      console.error("[demo-network]", err);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Eroare internă");
    }
  };
}

export interface RunningDemoNetwork {
  close(): Promise<void>;
  baseUrl: string;
  sources: DemoSource[];
  network: DemoNetwork;
}

/** Pornește rețeaua demo în proces (port 0 = port liber aleator). */
export async function startDemoNetwork(port = 4010): Promise<RunningDemoNetwork> {
  let net: DemoNetwork | undefined;
  const handler = (req: IncomingMessage, res: ServerResponse) => void createHandler(net!)(req, res);
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolve());
  });
  const actual = (server.address() as AddressInfo).port;
  const baseUrl = `http://localhost:${actual}`;
  net = new DemoNetwork(baseUrl);
  return {
    baseUrl,
    sources: net.sources(),
    network: net,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections?.();
        server.close((e) => (e ? reject(e) : resolve()));
      }),
  };
}

/* ------------------------------------------------------------------ CLI */

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.argv[2] ?? process.env.PORT ?? 4010);
  startDemoNetwork(port).then((n) => {
    console.log(`Rețeaua demo rulează la ${n.baseUrl}/`);
    console.log(`${OUTLETS.length} publicații, ${n.network.articles.length} articole, ${n.sources.length} fluxuri:`);
    for (const s of n.sources) console.log(`  ${s.id.padEnd(34)} ${s.url}`);
    console.log(`Știre de ultimă oră: curl ${n.baseUrl}/_control/add-breaking`);
    const t = Date.now();
    void n.network.warmImages().then((count) => console.log(`Imagini pregătite în cache: ${count} (${((Date.now() - t) / 1000).toFixed(0)} s)`));
  });
}
