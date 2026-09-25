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

const rtf = new Intl.RelativeTimeFormat("ro", { numeric: "auto" });

export function timeAgo(ts: number, now = Date.now()): string {
  const diff = Math.round((ts - now) / 1000);
  const abs = Math.abs(diff);
  if (abs < 45) return "chiar acum";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 2) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(ts);
}

export function formatDate(ts: number): string {
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  }).format(ts);
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
