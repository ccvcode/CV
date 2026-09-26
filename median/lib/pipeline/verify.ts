import { fold } from "./text";

/*
 * Verificări deterministe (în cod) ale unui text generat față de surse. Completează verificarea
 * făcută de al doilea model AI: citatele trebuie să existe exact, cifrele trebuie să apară în surse,
 * iar textul nu are voie să copieze secvențe lungi din surse (Legea 8/1996, art. 94¹: max. ~120 caractere).
 */

export interface CodeIssue {
  type: "citat" | "cifra" | "copiat" | "entitate" | "lungime";
  text: string;
  detail: string;
}

const norm = (s: string) =>
  fold(s)
    .replace(/[„”"«»'`’‘]/g, "")
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();

/** Elimină citatele directe din text (sunt verificate separat și pot fi preluate exact). */
function withoutQuotes(s: string): string {
  return s.replace(/„[^”]{0,600}”/g, " ").replace(/"[^"]{0,600}"/g, " ");
}

function numbersIn(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/\d+(?:[.,]\d+)*/g)) {
    const raw = m[0];
    // „1.200” / „1,200” (mii) -> „1200”; „3,5” rămâne zecimal.
    const thousands = /^\d{1,3}([.,]\d{3})+$/.test(raw);
    out.push(thousands ? raw.replace(/[.,]/g, "") : raw.replace(",", "."));
  }
  return out;
}

export function checkAgainstSources(opts: {
  text: string;
  quotes: { text: string }[];
  tags?: string[];
  sources: string[];
  /** Numele publicațiilor (ex. „Digi24”, „0-100.ro”): cifrele din nume nu sunt date factuale. */
  outlets?: string[];
  /** Momentele publicării surselor: zilele, anii și orele lor sunt permise în text. */
  dates?: number[];
  minWords?: number;
  maxCopiedWords?: number;
}): CodeIssue[] {
  const issues: CodeIssue[] = [];
  const srcNorm = opts.sources.map(norm);
  const srcAll = srcNorm.join(" \n ");

  // 1. Citatele: exacte (după normalizare de spații/diacritice/ghilimele).
  const inlineQuotes = [...opts.text.matchAll(/„([^”]{8,600})”/g)].map((m) => m[1]);
  for (const q of [...opts.quotes.map((q) => q.text), ...inlineQuotes]) {
    const nq = norm(q);
    if (nq.length < 8) continue;
    if (!srcAll.includes(nq)) issues.push({ type: "citat", text: q.slice(0, 200), detail: "citatul nu apare exact în surse" });
  }

  // 2. Cifrele: fiecare număr din text trebuie să apară în surse (1–12 sunt tolerate: pot fi scrise în litere în sursă).
  const srcNumbers = new Set(opts.sources.flatMap(numbersIn));
  for (const ts of opts.dates ?? []) {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(ts);
    for (const part of p) if (/^\d+$/.test(part.value)) srcNumbers.add(String(Number(part.value))).add(part.value);
    const y = new Date(ts).getUTCFullYear();
    srcNumbers.add(String(y - 1)).add(String(y + 1));
  }
  // Numele publicațiilor sunt eliminate înainte de extragerea cifrelor („potrivit Digi24”).
  let numText = opts.text;
  for (const o of opts.outlets ?? []) if (/\d/.test(o)) numText = numText.split(o).join(" ");
  const seen = new Set<string>();
  for (const n of numbersIn(numText)) {
    if (seen.has(n)) continue;
    seen.add(n);
    const v = Number(n);
    if (Number.isFinite(v) && v >= 0 && v <= 12 && !n.includes(".")) continue;
    if (!srcNumbers.has(n)) issues.push({ type: "cifra", text: n, detail: "cifra nu apare în surse" });
  }

  // 3. Secvențe copiate: nicio fereastră de N cuvinte (în afara citatelor) identică cu o sursă.
  const maxWords = opts.maxCopiedWords ?? 14;
  const words = norm(withoutQuotes(opts.text)).split(" ").filter(Boolean);
  const shingles = new Set<string>();
  for (const s of srcNorm) {
    const w = s.split(" ").filter(Boolean);
    for (let i = 0; i + maxWords <= w.length; i++) shingles.add(w.slice(i, i + maxWords).join(" "));
  }
  for (let i = 0; i + maxWords <= words.length; i++) {
    const sh = words.slice(i, i + maxWords).join(" ");
    if (shingles.has(sh)) {
      issues.push({ type: "copiat", text: sh.slice(0, 200), detail: `secvență de ${maxWords}+ cuvinte identică cu o sursă` });
      break;
    }
  }

  // 4. Etichetele (nume proprii) trebuie să apară în surse.
  for (const tag of opts.tags ?? []) {
    const parts = norm(tag).split(" ").filter((p) => p.length >= 4);
    if (!parts.length) continue;
    const found = parts.some((p) => srcAll.includes(p.slice(0, Math.max(4, p.length - 2))));
    if (!found) issues.push({ type: "entitate", text: tag, detail: "numele nu apare în surse" });
  }

  // 5. Lungimea minimă.
  if (opts.minWords) {
    const wc = opts.text.split(/\s+/).filter(Boolean).length;
    if (wc < opts.minWords) issues.push({ type: "lungime", text: String(wc), detail: `articol prea scurt (${wc} cuvinte)` });
  }
  return issues;
}

/** Diacritice corecte (virgulă, nu sedilă) și spații curate. */
export function tidy(s: string): string {
  return s
    .replace(/ş/g, "ș")
    .replace(/Ş/g, "Ș")
    .replace(/ţ/g, "ț")
    .replace(/Ţ/g, "Ț")
    .replace(/[ \t]+/g, " ")
    .replace(/ ([,.;:!?])/g, "$1")
    .trim();
}
