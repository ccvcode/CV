const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–",
  laquo: "«", raquo: "»", bdquo: "„", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", sbquo: "‚",
  icirc: "î", Icirc: "Î", acirc: "â", Acirc: "Â", abreve: "ă", Abreve: "Ă", scedil: "ş", Scedil: "Ş",
  tcedil: "ţ", Tcedil: "Ţ", eacute: "é", egrave: "è", ouml: "ö", uuml: "ü", auml: "ä", copy: "©", reg: "®", deg: "°", euro: "€",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Normalizează diacriticele cu sedilă (ş/ţ) la forma corectă cu virgulă (ș/ț). */
export function fixDiacritics(s: string): string {
  return s.replace(/ş/g, "ș").replace(/Ş/g, "Ș").replace(/ţ/g, "ț").replace(/Ţ/g, "Ț");
}

/**
 * Titlul unei surse, curățat pentru afișare: fără etichete de tip „ULTIMA ORĂ”, „VIDEO”, „FOTO”,
 * „BREAKING”, „(P)”; primul titlu dintr-unul dublu („A / B”, „A | B”, „A » B”); fără MAJUSCULE
 * integrale; semnele de exclamare devin punct. Faptele din titlu rămân neschimbate.
 */
export function cleanTitle(raw: string): string {
  let t = raw.replace(/\s+/g, " ").trim();
  // Cuvinte „spațiate” de tip „F A S H I O N” → „FASHION”.
  t = t.replace(/\b(?:[A-ZĂÂÎȘȚ] ){3,}[A-ZĂÂÎȘȚ]\b/g, (m) => m.replace(/ /g, ""));
  // Etichete scrise cu majuscule la începutul titlului (nu și cuvintele obișnuite „Video…”, „Foto…”).
  const label =
    /^(?:\(P\)\s*|[\w-]+\.ro\s+[-–]\s+|(?:ULTIMA OR[ĂA]|BREAKING(?: NEWS)?|UPDATE|ACTUALIZARE|VIDEO|FOTO|GALERIE FOTO|LIVE(?: BLOG| TEXT| VIDEO)?|EXCLUSIV|DECLARA[ȚŢT]II|OFICIAL|ALERT[ĂA]|INTERVIU|DOCUMENT|SONDAJ|ANALIZ[ĂA]|OPINIE|SURSE|AST[ĂA]ZI|ATEN[ȚŢT]IE)(?=[\s\-–—:|.,/]|$)\s*(?:[-–—:|.,/]\s*)?)+/u;
  t = t.replace(label, "").trim();
  // Două titluri lipite: păstrăm primul, dacă e o frază completă; altfel „A » B” devine „A: B”.
  const split = /\s(?:\/|\||»)\s/.exec(t);
  if (split && split.index >= 35) t = t.slice(0, split.index).trim();
  else t = t.replace(/\s»\s/g, ": ");
  // Titluri scrise integral cu majuscule → majusculă doar la început.
  const letters = t.replace(/[^A-Za-zĂÂÎȘŞȚŢăâîșşțţ]/g, "");
  if (letters.length > 12 && letters === letters.toUpperCase()) t = t.charAt(0) + t.slice(1).toLowerCase();
  t = t.replace(/!+(?=\s+\S)/g, ".").replace(/[!]+$/g, "").replace(/\s*[.,:;–-]\s*$/, "").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function stripHtml(html: string): string {
  let decoded = decodeEntities(
    html
      .replace(/<(script|style|figure|figcaption|iframe)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
  );
  // Unele feed-uri escapează entitățile de două ori („&amp;amp;”).
  if (/&(amp|lt|gt|quot|#\d+|#x[0-9a-f]+);/i.test(decoded)) decoded = decodeEntities(decoded).replace(/<[^>]+>/g, " ");
  return fixDiacritics(decoded)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanText(s: string): string {
  return stripHtml(s).replace(/\s+/g, " ").trim();
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–-]+$/, "") + "…";
}

const DIACRITICS: Record<string, string> = { ă: "a", â: "a", î: "i", ș: "s", ş: "s", ț: "t", ţ: "t" };

export function slugify(s: string, max = 80): string {
  return s
    .toLowerCase()
    .replace(/[ăâîșşțţ]/g, (c) => DIACRITICS[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
}

/** Hash FNV-1a pe 32 biți, redat în baza 36 — ID stabil și scurt pentru articole. */
export function hashId(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let h2 = 0x12345678;
  for (let i = s.length - 1; i >= 0; i--) {
    h2 ^= s.charCodeAt(i);
    h2 = Math.imul(h2, 0x5bd1e995);
  }
  return (h >>> 0).toString(36) + (h2 >>> 0).toString(36).slice(0, 3);
}

export function readingTime(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

const DAY_KEY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }); // „2026-09-26”

/** Zile calendaristice (ora României) între două momente: 0 = aceeași zi, 1 = ieri. */
function daysBetween(ts: number, now: number): number {
  const d = (t: number) => Date.parse(DAY_KEY.format(t) + "T00:00:00Z");
  return Math.round((d(now) - d(ts)) / 86400_000);
}

/**
 * Un singur format pentru orele de pe site: „chiar acum”, „acum 12 min”, „acum 3 ore”,
 * apoi „azi, 14:05”, „ieri, 09:30” și „24 sept., 14:05”.
 */
export function timeAgo(ts: number, now = Date.now()): string {
  const min = Math.round((now - ts) / 60_000);
  if (min < 1) return "chiar acum";
  if (min < 60) return `acum ${min} min`;
  const days = daysBetween(ts, now);
  if (min < 6 * 60 && days === 0) {
    const h = Math.round(min / 60);
    return h === 1 ? "acum o oră" : `acum ${h} ore`;
  }
  return formatDate(ts, now);
}

/** „azi, 14:05” / „ieri, 09:30” / „24 sept., 14:05”. */
export function formatDate(ts: number, now = Date.now()): string {
  return `${dayLabel(ts, now)}, ${formatTime(ts)}`;
}

/** „azi” / „ieri” / „24 sept.”. */
export function dayLabel(ts: number, now = Date.now()): string {
  const days = daysBetween(ts, now);
  return days === 0 ? "azi" : days === 1 ? "ieri" : formatDay(ts, now);
}

/** „24 sept.” (cu anul, dacă nu e cel curent). */
export function formatDay(ts: number, now = Date.now()): string {
  const year = new Date(ts).getUTCFullYear() !== new Date(now).getUTCFullYear();
  return new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "Europe/Bucharest" }).format(ts);
}

export function formatTime(ts: number): string {
  return new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }).format(ts);
}

export function formatLongDate(ts: number): string {
  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  }).format(ts);
}

export function articleHref(a: { id: string; slug: string }): string {
  return `/articol/${a.id}${a.slug ? "-" + a.slug : ""}`;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function faviconUrl(site: string): string {
  return `https://www.google.com/s2/favicons?domain=${domainOf(site)}&sz=64`;
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
