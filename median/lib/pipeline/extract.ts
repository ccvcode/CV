// Extragerea textului complet din paginile articolelor (Readability + linkedom, cu curățare pentru site-urile românești).
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

export type ExtractedImage = { src: string; caption?: string };
export type Block = { type: 'p' | 'h' | 'li' | 'quote'; text: string };
export type ExtractedArticle = {
  title?: string;
  text: string;
  paragraphs: string[];
  image?: string;
  author?: string;
  published?: number;
  siteName?: string;
  /** extras (optional): typed blocks keep subheadings distinguishable; images with captions */
  blocks?: Block[];
  images?: ExtractedImage[];
};

const MIN_TEXT = 250; // below this we consider extraction failed

/* ---------------------------------------------------------------- cleaning */

// Elements that are never article text.
const REMOVE_SELECTORS = [
  'script:not([type="application/ld+json"])', 'style', 'noscript', 'iframe', 'object', 'embed',
  'form', 'button', 'input', 'select', 'textarea', 'svg', 'canvas', 'video', 'audio',
  'header', 'footer', 'nav', 'aside', '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
  // ads
  'ins', '.adsbygoogle', '[id^="div-gpt-ad"]', '[id*="google_ads"]', '[class^="ad-"]', '[class*=" ad-"]',
  '[class*="-ad "]', '[class$="-ad"]', '[class*="advert"]', '[class*="banner"]', '[class*="publicitate"]',
  '[class*="sponsor"]', '[data-ad]', '[data-banner]', '[id*="taboola"]', '[class*="taboola"]',
  '[id*="outbrain"]', '[class*="outbrain"]', '[class*="gemius"]', '[class*="inread"]',
  // social embeds / share bars
  'blockquote.twitter-tweet', 'blockquote.instagram-media', 'blockquote.tiktok-embed', '.fb-post', '.fb-video',
  '[class*="twitter-embed"]', '[class*="instagram"]', '[class*="tiktok"]', '[class*="facebook"]',
  '[class*="share"]', '[class*="social"]', '[class*="whatsapp"]',
  // related / recommended / read-more / newsletter / promos
  '[class*="related"]', '[class*="recommend"]', '[class*="read-more"]', '[class*="readmore"]',
  '[class*="read-also"]', '[class*="citeste"]', '[class*="vezi-si"]', '[class*="more-news"]',
  '[class*="newsletter"]', '[class*="subscribe"]', '[class*="abonare"]', '[class*="promo"]',
  '[class*="popular"]', '[class*="most-read"]', '[class*="trending"]', '[class*="widget"]',
  '[class*="google-news"]', '[class*="gdpr"]', '[class*="cookie"]', '[id*="cookie"]', '[class*="consent"]',
  // chrome around the article
  '[class*="comment"]', '[id*="comment"]', '[class*="author-box"]', '[class*="tags"]', '[class*="breadcrumb"]',
  '[class*="sidebar"]', '[class*="byline"]', '[class*="author"]', '[class*="entry-meta"]', '[class*="article-meta"]', '[class*="post-meta"]', 'time', '[class*="disclaimer"]', '[class*="paywall"]', '[class*="modal"]', '[class*="popup"]',
].join(',');

const fold = (s: string) =>
  s.toLowerCase().replace(/ş/g, 'ș').replace(/ţ/g, 'ț').normalize('NFD').replace(/[̀-ͯ]/g, '');

// Boilerplate lines (matched on folded, diacritic-free text).
const BOILERPLATE = [
  /^(citeste|cititi|citește) (si|și|mai mult|continuarea)\b/, /^citeste si\b/, /^vezi si\b/, /^vezi (galeria|video|foto)/,
  /^(recomandari|recomandarea|te-ar putea interesa|articole (similare|recomandate)|mai multe (stiri|articole))\b/,
  /^urmareste(ti)? .*(google news|facebook|instagram|tiktok|whatsapp|youtube|canal|aplicati)/,
  /^(aboneaza-te|aboneaza te|abonati-va|descarca aplicatia|susține|sustine)\b/,
  /^(foto|video|sursa foto|sursa|galerie foto|credit foto)\s*[:|-]/, /^(editor|autor|autori|redactor)\s*:/,
  /^(publicitate|advertisement|reclama)$/, /^daca ti-a placut/, /^(distribuie|share)\b/,
  /^(ne gasesti|intra pe|click aici|apasa aici)\b/, /continuarea (articolului )?pe\b/, /^(acest articol|articolul) (a fost|este) (publicat|scris)/,
];
const isBoilerplate = (t: string) => {
  const f = fold(t).trim();
  return f.length < 300 && BOILERPLATE.some((re) => re.test(f));
};

function absolutize(u: string | null | undefined, base: string): string | undefined {
  if (!u) return;
  u = u.trim().split(/\s+/)[0]; // srcset first candidate
  if (!u || u.startsWith('data:') || u.startsWith('blob:')) return;
  try { return new URL(u, base).href; } catch { return; }
}

function fixLazyImages(doc: Document) {
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    const lazy = ['data-src', 'data-lazy-src', 'data-original', 'data-srcset', 'data-lazy-srcset', 'srcset']
      .map((a) => img.getAttribute(a)).find((v) => v && !v.startsWith('data:'));
    const src = img.getAttribute('src');
    if ((!src || src.startsWith('data:') || /blank|placeholder|spacer|lazy/i.test(src)) && lazy)
      img.setAttribute('src', lazy.split(',').pop()!.trim().split(/\s+/)[0]);
  }
}

function preClean(doc: Document) {
  fixLazyImages(doc);
  for (const el of Array.from(doc.querySelectorAll(REMOVE_SELECTORS))) {
    // never drop the whole article because a wrapper has a matching class
    if (el.querySelectorAll('p').length > 5 || el.tagName === 'BODY' || el.tagName === 'HTML' || el.tagName === 'MAIN' || el.tagName === 'ARTICLE') continue;
    el.remove();
  }
  // "Citește și: <link>" paragraphs/boxes and short link-only paragraphs
  for (const el of Array.from(doc.querySelectorAll('p, div, section, li, h3, h4, strong'))) {
    if (!el.isConnected) continue;
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    if (isBoilerplate(t) && el.querySelectorAll('p').length <= 1) { el.remove(); continue; }
    if (el.tagName === 'P' && t.length < 160) {
      const linkText = Array.from(el.querySelectorAll('a')).reduce((n, a) => n + (a.textContent || '').trim().length, 0);
      if (linkText / t.length > 0.8) el.remove();
    }
  }
}

/* ------------------------------------------------------------ metadata */

type Meta = { title?: string; author?: string; published?: string; image?: string; siteName?: string; body?: string };

const ARTICLE_TYPES = /^(NewsArticle|Article|ReportageNewsArticle|AnalysisNewsArticle|OpinionNewsArticle|BlogPosting|LiveBlogPosting|Report|WebPage)$/;

function names(v: any): string | undefined {
  const arr = (Array.isArray(v) ? v : [v]).map((a) => (typeof a === 'string' ? a : a?.name)).filter(Boolean);
  const clean = arr.map((s: string) => s.trim()).filter((s: string) => s && !/^https?:\/\//.test(s));
  return clean.length ? [...new Set(clean)].join(', ') : undefined;
}
const firstImage = (v: any): string | undefined =>
  !v ? undefined : typeof v === 'string' ? v : Array.isArray(v) ? firstImage(v[0]) : v.url || v.contentUrl;

function readJsonLd(doc: Document): Meta {
  const nodes: any[] = [];
  for (const s of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const raw = (s.textContent || '').replace(/[\u0000-\u001f]+/g, ' '); // raw newlines inside strings are common
      const walk = (n: any) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) return n.forEach(walk); nodes.push(n); if (n['@graph']) walk(n['@graph']); };
      walk(JSON.parse(raw));
    } catch { /* broken JSON-LD is common; ignore */ }
  }
  const types = (n: any) => ([] as string[]).concat(n['@type'] || []);
  const art = nodes.find((n) => types(n).some((t) => t !== 'WebPage' && ARTICLE_TYPES.test(t)))
    || nodes.find((n) => n.articleBody);
  if (!art) return {};
  // restore paragraph breaks: articleBody often uses \r\n which the control-char strip above flattened, so re-read raw
  return {
    title: art.headline || art.name,
    author: names(art.author),
    published: art.datePublished || art.dateCreated,
    image: firstImage(art.image) || firstImage(art.thumbnailUrl),
    siteName: names(art.publisher),
    body: typeof art.articleBody === 'string' ? art.articleBody : undefined,
  };
}

// articleBody with original line breaks (JSON.parse after only escaping raw control chars)
function readJsonLdBodyRaw(doc: Document): string | undefined {
  for (const s of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    const raw = s.textContent || '';
    if (!raw.includes('articleBody')) continue;
    try {
      const fixed = raw.replace(/[\u0000-\u001f]/g, (c) => (c === '\n' ? '\\n' : c === '\r' ? '\\r' : c === '\t' ? '\\t' : ' '));
      let found: string | undefined;
      JSON.parse(fixed, (k, v) => { if (k === 'articleBody' && typeof v === 'string' && !found) found = v; return v; });
      if (found) return found;
    } catch { /* ignore */ }
  }
}

const meta = (doc: Document, ...keys: string[]) => {
  for (const k of keys) {
    const el = doc.querySelector(`meta[property="${k}"], meta[name="${k}"], meta[itemprop="${k}"]`);
    const v = el?.getAttribute('content')?.trim();
    if (v) return v;
  }
};

function toEpoch(v?: string | null): number | undefined {
  if (!v) return;
  const t = Date.parse(v.trim());
  if (!Number.isNaN(t)) return t;
  // "25.09.2026, 07:12" / "25-09-2026 07:12" — assume Romania time (EET/EEST; approximated via Intl)
  const m = v.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
  if (!m) return;
  const [, d, mo, y, h = '0', mi = '0'] = m;
  const utc = Date.UTC(+y, +mo - 1, +d, +h, +mi);
  const off = tzOffsetMs(utc, 'Europe/Bucharest');
  return utc - off;
}
function tzOffsetMs(utc: number, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(utc)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - utc;
}

const cleanAuthor = (a?: string | null) => {
  const s = a?.replace(/\s+/g, ' ').replace(/^(de|by|autor(i)?|scris de|semnat de)\s*:?\s+/i, '').trim();
  return s && s.length < 120 && !/^https?:/.test(s) ? s : undefined;
};

/* ------------------------------------------------------------ content walk */

const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'TD', 'DD', 'DT']);
const SKIP_TAGS = new Set(['FIGURE', 'FIGCAPTION', 'PICTURE', 'IMG', 'TABLE', 'SCRIPT', 'STYLE']);

function textOf(el: Element): string[] {
  // turn <br> into line breaks, then split
  const html = (el as any).innerHTML as string;
  const withBreaks = html.replace(/<br\s*\/?>/gi, '\n');
  const tmp = el.ownerDocument.createElement('div');
  tmp.innerHTML = withBreaks;
  return (tmp.textContent || '').split(/\n{1,}/).map((s) => s.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean);
}

function walk(root: Element, blocks: Block[], images: ExtractedImage[], base: string) {
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === 3) { // stray text directly inside a container
      const t = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.length > 40) blocks.push({ type: 'p', text: t });
      continue;
    }
    if (node.nodeType !== 1) continue;
    const el = node as Element;
    const tag = el.tagName;
    if (tag === 'FIGURE' || tag === 'IMG' || tag === 'PICTURE') { collectImages(el, images, base); continue; }
    if (SKIP_TAGS.has(tag)) continue;
    if (tag === 'UL' || tag === 'OL') { walk(el, blocks, images, base); continue; }
    if (BLOCK_TAGS.has(tag)) {
      if (el.querySelector('p, div, ul, ol, h2, h3')) { walk(el, blocks, images, base); continue; } // e.g. blockquote > p
      el.querySelectorAll('img, figure').forEach((f) => collectImages(f, images, base));
      const type: Block['type'] = /^H\d$/.test(tag) ? 'h' : tag === 'LI' ? 'li' : tag === 'BLOCKQUOTE' ? 'quote' : 'p';
      for (const t of textOf(el)) blocks.push({ type, text: t });
      continue;
    }
    walk(el, blocks, images, base); // div/section/span/strong wrappers
  }
}

function collectImages(el: Element, images: ExtractedImage[], base: string) {
  const imgs = el.tagName === 'IMG' ? [el] : Array.from(el.querySelectorAll('img'));
  const figure = el.closest('figure') || (el.tagName === 'FIGURE' ? el : null);
  const caption = figure?.querySelector('figcaption')?.textContent?.replace(/\s+/g, ' ').trim()
    || imgs[0]?.getAttribute('alt')?.trim() || undefined;
  for (const img of imgs) {
    const src = absolutize(img.getAttribute('src'), base)
      || absolutize(img.closest('picture')?.querySelector('source')?.getAttribute('srcset'), base);
    if (!src || /logo|avatar|icon|pixel|spacer|\.gif($|\?)/i.test(src)) continue;
    const w = Number(img.getAttribute('width') || 0);
    if (w && w < 120) continue;
    if (!images.some((i) => i.src === src)) images.push({ src, caption: caption || undefined });
  }
}

function finalize(blocks: Block[], title?: string): Block[] {
  const out: Block[] = [];
  const seen = new Set<string>();
  const ft = title ? fold(title) : '';
  for (const b of blocks) {
    const t = b.text.replace(/\s+/g, ' ').trim();
    if (!t || isBoilerplate(t)) continue;
    const f = fold(t);
    if (f === ft || seen.has(f)) continue;
    if (b.type !== 'h' && t.length < 3) continue;
    if (t.length < 80 && /\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b|\b\d{1,2}:\d{2}\b/.test(t) && !/[.!?]$/.test(t)) continue; // "Nume 25.09.2026, 07:12"
    if (t.length < 80 && /^(actualizat|publicat|update)\b/i.test(fold(t))) continue;
    seen.add(f);
    out.push({ ...b, text: t });
  }
  while (out.length && out[out.length - 1].type === 'h') out.pop(); // dangling heading at end
  return out;
}

function blocksFromPlainBody(body: string): Block[] {
  let parts = body.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1 && body.length > 1200) // single blob → split roughly every ~3 sentences
    parts = body.match(/[^.!?]+[.!?]+["”»]?\s*/g)?.reduce<string[]>((acc, s, i) => {
      if (i % 3 === 0) acc.push(s.trim()); else acc[acc.length - 1] += ' ' + s.trim(); return acc;
    }, []) ?? parts;
  return parts.map((text) => ({ type: text.length < 90 && !/[.!?:;"”]$/.test(text) ? 'h' : 'p', text }));
}

/* ------------------------------------------------------------ scoping */

// Readability is super-linear on huge DOMs (infinite-scroll pages, 1000s of teaser cards).
// On big pages, hand it only the article wrapper found via common CMS selectors.
const CONTENT_SELECTORS = [
  '[itemprop="articleBody"]', '.entry-content', '.article-body', '.article-content', '.article__content',
  '.article-text', '.post-content', '.single-content', '.content-article', '.story-body', '.news-content',
  '.entry', '.articol', '.continut', '#article-content', 'article',
].join(',');
const BIG_DOM = 1500;

function scopeDocument(doc: Document): Document {
  const total = doc.querySelectorAll('*').length;
  if (total < BIG_DOM) return doc;
  let best: Element | null = null, bestLen = 0;
  for (const el of Array.from(doc.querySelectorAll(CONTENT_SELECTORS))) {
    const ps = Array.from(el.querySelectorAll('p'));
    if (ps.length > 300) continue; // a listing, not an article
    const len = ps.reduce((n, p) => n + (p.textContent || '').trim().length, 0);
    if (len > bestLen) { best = el; bestLen = len; }
  }
  if (!best || bestLen < 400) return doc;
  // widen to the wrapper that also holds the <h1> (keeps lead/intro paragraphs), if still small
  const h1 = doc.querySelector('h1');
  let scope: Element = best;
  for (let a: Element | null = best; a && a.tagName !== 'BODY'; a = a.parentElement) {
    if (h1 && a.contains(h1)) { if (a.querySelectorAll('*').length < BIG_DOM) scope = a; break; }
  }
  const { document: small } = parseHTML(`<!doctype html><html><head><title>${doc.title}</title></head><body>${(scope as any).outerHTML}</body></html>`) as unknown as { document: Document };
  return small;
}

/* ------------------------------------------------------------ main */

export async function extractArticle(html: string, url: string): Promise<ExtractedArticle | null> {
  if (!html || html.length < 200) return null;
  try {
    html = html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script\b(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<(style|svg|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    const { document } = parseHTML(html) as unknown as { document: Document };
    const ld = readJsonLd(document);
    const ldBody = readJsonLdBodyRaw(document) ?? ld.body;

    const title = meta(document, 'og:title', 'twitter:title') || ld.title
      || document.querySelector('h1')?.textContent?.trim() || document.title?.trim() || undefined;
    const siteName = meta(document, 'og:site_name', 'application-name') || ld.siteName;
    const publishedRaw = ld.published || meta(document, 'article:published_time', 'datePublished', 'pubdate', 'publish-date', 'sailthru.date', 'DC.date.issued')
      || document.querySelector('time[datetime]')?.getAttribute('datetime');
    const metaAuthor = ld.author || meta(document, 'author', 'article:author', 'dc.creator', 'parsely-author', 'sailthru.author');
    const domAuthor = document.querySelector('[rel="author"], [itemprop="author"] [itemprop="name"], [itemprop="author"], [class*="author-name"], [class*="byline"], .autor, .author')
      ?.textContent?.split(/[,|•·]|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/)[0];
    const leadImage = absolutize(meta(document, 'og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src') || ld.image, url);

    preClean(document);

    const reader = new Readability<Element>(scopeDocument(document), {
      charThreshold: 300,
      keepClasses: false,
      serializer: (n: Node) => n as Element, // return the element itself: no HTML re-serialization/re-parse
    });
    const art = reader.parse();

    let blocks: Block[] = [];
    const images: ExtractedImage[] = [];
    if (art?.content) {
      walk(art.content, blocks, images, url);
      blocks = finalize(blocks, title);
    }
    let domText = blocks.map((b) => b.text).join('\n\n');

    // JSON-LD articleBody: use if DOM extraction failed or is clearly truncated (e.g. teaser/paywall markup)
    if (ldBody) {
      const ldBlocks = finalize(blocksFromPlainBody(ldBody.replace(/<[^>]+>/g, ' ')), title);
      const ldText = ldBlocks.map((b) => b.text).join('\n\n');
      if (ldText.length > Math.max(domText.length * 1.3, MIN_TEXT)) { blocks = ldBlocks; domText = ldText; }
    }
    if (domText.length < MIN_TEXT) return null;

    const author = cleanAuthor(metaAuthor) || cleanAuthor(domAuthor) || cleanAuthor(art?.byline);
    const published = toEpoch(publishedRaw) ?? toEpoch(art?.publishedTime);
    const image = leadImage || images[0]?.src;

    return {
      title: title?.replace(/\s+/g, ' ').trim(),
      text: domText,
      paragraphs: blocks.map((b) => b.text),
      image,
      author,
      published,
      siteName: siteName || art?.siteName || undefined,
      blocks,
      images,
    };
  } catch {
    return null;
  }
}
