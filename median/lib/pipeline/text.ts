import type { RegionSlug } from "../core/types";

/** Litere mici, fără diacritice (ș/ş -> s etc.). */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/[şș]/g, "s")
    .replace(/[ţț]/g, "t")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const STOP = new Set(
  (
    "si sau dar iar ca ce cu de la in din pe pentru prin despre catre dupa inainte fara sub peste intre spre " +
    "un o unei unui niste cei cele cea cel lui lor ei el ea ele este sunt a au fost fi va vor ar mai " +
    "nu da cum cand unde care cine acest aceasta acesti aceste acel acea asta azi ieri maine noi nou noua " +
    "foarte doar tot toti toate totul iata video foto live update breaking ultima ora surpriza exclusiv " +
    "anunt anunta anuntat spune spus declarat afirmat dezvaluie dezvaluit cum ce care cat ani anul zile zi " +
    "the and of to for on with at by from new says after over into"
  ).split(" ")
);

/** Cuvinte-cheie normalizate dintr-un titlu (tulpină aproximativă = primele 6 litere). */
export function keywords(title: string): string[] {
  const out = new Set<string>();
  for (const w of fold(title).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/)) {
    if (w.length < 3 || STOP.has(w)) continue;
    out.add(/^\d+$/.test(w) ? w : w.slice(0, 6));
  }
  return [...out];
}

/**
 * Nume proprii: secvențe de cuvinte cu majusculă (cu „de/din/și” între ele), comparate ca întreg —
 * „Institutul Național de Statistică” ≠ „Institutul Național de Sănătate Publică”.
 * Primul cuvânt al propoziției e ignorat dacă e singur (poate fi doar începutul frazei).
 */
export function entities(text: string): string[] {
  const out = new Set<string>();
  const tokens = text.replace(/[„”"«»:;,.!?()[\]]/g, " | ").split(/\s+/).filter(Boolean);
  let cur: string[] = [];
  let startsSentence = true;
  const flush = (sentenceStart: boolean) => {
    const words = cur.filter((w) => !/^(de|din|și|si|la|al|a)$/i.test(w));
    if (words.length >= 2 || (words.length === 1 && !sentenceStart)) out.add(words.map((w) => fold(w).slice(0, 6)).join(" "));
    cur = [];
  };
  let curStartsSentence = false;
  for (const t of tokens) {
    if (t === "|") {
      if (cur.length) flush(curStartsSentence);
      startsSentence = true;
      continue;
    }
    const cap = /^[A-ZĂÂÎȘŞȚŢ][a-zăâîșşțţ]{2,}/.test(t) || /^[A-ZĂÂÎȘŞȚŢ]{2,6}$/.test(t);
    const connector = cur.length > 0 && /^(de|din|și|si)$/.test(t);
    if (cap || connector) {
      if (!cur.length) curStartsSentence = startsSentence;
      cur.push(t);
    } else if (cur.length) flush(curStartsSentence);
    startsSentence = false;
  }
  if (cur.length) flush(curStartsSentence);
  return [...out];
}

/* ------------------------------------------------------------------ similaritate între articole */

export interface DocVector {
  /** termen -> pondere (titlul contează dublu față de lead) */
  terms: Record<string, number>;
  entities: Set<string>;
  numbers: Set<string>;
}

/** Vector de termeni din titlu + începutul textului (lead), cu nume proprii și cifre separate. */
export function docVector(title: string, lead: string): DocVector {
  const terms: Record<string, number> = {};
  const add = (text: string, w: number) => {
    for (const k of keywords(text)) terms[k] = Math.max(terms[k] ?? 0, w);
  };
  add(title, 2);
  add(lead.slice(0, 400), 1);
  const numbers = new Set<string>();
  for (const m of (title + " " + lead.slice(0, 400)).matchAll(/\d+(?:[.,]\d+)?/g)) if (m[0].length >= 2 || /[.,]/.test(m[0])) numbers.add(m[0].replace(",", "."));
  return { terms, entities: new Set([...entities(title), ...entities(lead.slice(0, 400))]), numbers };
}

/**
 * Decizia „același subiect”: similaritate mare, sau similaritate moderată confirmată de cel puțin
 * un nume propriu sau o cifră comună (evită grupările pe cuvinte generice precum „au crescut”).
 */
export function sameStory(a: DocVector, b: DocVector, idf: (t: string) => number): { same: boolean; score: number } {
  const score = similarity(a, b, idf);
  if (score >= 0.36) return { same: true, score };
  if (score < 0.2) return { same: false, score };
  // Numele proprii foarte frecvente („România”, „Guvernul”) nu confirmă nimic.
  for (const e of a.entities) if (b.entities.has(e) && idf(e) >= 2.2) return { same: true, score };
  for (const n of a.numbers) if (b.numbers.has(n)) return { same: true, score };
  return { same: false, score };
}

/** Similaritate cosinus ponderată TF-IDF, plus bonus pentru nume proprii și cifre comune. */
export function similarity(a: DocVector, b: DocVector, idf: (t: string) => number): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, w] of Object.entries(a.terms)) {
    const x = w * idf(t);
    na += x * x;
    const wb = b.terms[t];
    if (wb) dot += x * wb * idf(t);
  }
  for (const [t, w] of Object.entries(b.terms)) {
    const x = w * idf(t);
    nb += x * x;
  }
  let cos = na && nb ? dot / Math.sqrt(na * nb) : 0;
  let sharedEnt = 0;
  for (const e of a.entities) if (b.entities.has(e)) sharedEnt++;
  let sharedNum = 0;
  for (const n of a.numbers) if (b.numbers.has(n)) sharedNum++;
  cos += Math.min(sharedEnt, 3) * 0.05 + Math.min(sharedNum, 2) * 0.06;
  return cos;
}

/** Amprentă a textului (shingles de 5 caractere, hash-uite) pentru detectarea preluărilor identice. */
export function fingerprint(text: string): string {
  const s = fold(text).replace(/[^a-z0-9]+/g, " ").trim().slice(0, 600);
  const set = new Set<number>();
  for (let i = 0; i + 5 <= s.length; i += 2) {
    let h = 0;
    for (let j = i; j < i + 5; j++) h = (Math.imul(h, 31) + s.charCodeAt(j)) | 0;
    set.add(h >>> 0);
  }
  // Păstrăm cele mai mici 64 de hash-uri (MinHash simplificat).
  return [...set].sort((a, b) => a - b).slice(0, 64).map((n) => n.toString(36)).join(" ");
}

export function fingerprintSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const A = new Set(a.split(" "));
  const B = b.split(" ");
  let inter = 0;
  for (const x of B) if (A.has(x)) inter++;
  return inter / Math.max(1, Math.min(A.size, B.length));
}

/* ------------------------------------------------------------------ regiuni (Internațional) */

const REGIONS: [RegionSlug, RegExp][] = [
  ["ucraina", /\b(ucrain|kiev|kyiv|zelenski|zelensky|rusia|rusiei|rusesc|ruse\b|rusi\b|putin\b|kremlin|moscov|donbas|harkov|odesa|crimeea)/],
  ["moldova", /\b(moldov|chisinau|sandu|transnistr|gagauz)/],
  ["orientul-mijlociu", /\b(israel|gaza|hamas|hezbollah|liban|iran|teheran|siria|irak|yemen|houthi|saudit|netanyahu|cisiordani|palestin)/],
  ["sua", /\b(sua\b|statele unite|washington|trump|casa alba|pentagon|congres|senatul american|new york|california|biden|vance|americani)/],
  ["asia", /\b(china|beijing|taiwan|japoni|tokyo|coreea|phenian|seul|india\b|pakistan|afganistan|indonezi|vietnam|filipin)/],
  ["europa", /\b(ue\b|uniunea europeana|bruxelles|comisia europeana|parlamentul european|germani|berlin|franta|paris|macron|merz|itali|spani|polon|ungari|orban|bulgari|serbi|grecia|austri|olanda|belgia|marea britanie|londra|europa\b|zona euro)/],
];

export function detectRegion(text: string): RegionSlug | undefined {
  const t = fold(text);
  for (const [slug, re] of REGIONS) if (re.test(t)) return slug;
  return undefined;
}

/* ------------------------------------------------------------------ subiecte sensibile */

const SENSITIVE: [string, RegExp][] = [
  ["sinucidere", /\b(sinucid|s-a sinucis|si-a luat viata|suicid)/],
  ["minori", /\b(minor[aie]?|copil|copii|eleva|elev|bebelus|fetit|baietel|adolescent)\b.*\b(abuz|agresat|violat|ucis|mort|disparut|batut|rapit)|\b(abuz|agresat|violat|ucis|batut|rapit)\b.*\b(minor|copil|eleva|elev|fetit|baietel)/],
  ["viol", /\b(viol|violat|agresiune sexuala|agresat sexual|pedofil)/],
  ["deces", /\b(a murit|au murit|decedat|decese|si-a pierdut viata|mort[ia]?\b|morti|cadavru|ucis|ucisi|omor|crima|crime|tragedie)/],
  ["justitie", /\b(retinut|arestat|condamnat|inculpat|perchezit|dna|diicot|parchet|dosar penal|trimis in judecata|acuzat)/],
];

/** Etichete de sensibilitate (după regulile CNA și ale Codului deontologic, adoptate ca reguli interne). */
export function detectSensitive(text: string): string[] {
  const t = fold(text);
  return SENSITIVE.filter(([, re]) => re.test(t)).map(([k]) => k);
}

/* ------------------------------------------------------------------ clasificare pe categorii */

const CATEGORY_RULES: [CategorySlugLite, RegExp][] = [
  ["politica", /\b(guvern|parlament|senat|deputat|ministr|premier|presedint|partid|psd|pnl|usr|aur|udmr|alegeri|coalit|motiun|cotroceni|consiliul local|primar)/g],
  ["economie", /\b(inflati|bnr|curs(ul)? valutar|euro\b|lei\b|buget|deficit|tax|impozit|salari|pret|scump|investit|fabric|compani|bursa|bvb|pib|export|anaf|tva|dobanz|credit|banc)/g],
  ["sport", /\b(meci|fotbal|gol|campionat|superliga|nationala de|tenis|turneu|handbal|jucat|antrenor|olimpic|medali|formula 1|echipa|stadion|victorie|calificat)/g],
  ["tech", /\b(inteligenta artificiala|\bai\b|software|aplicati|smartphone|telefon|cibernetic|ransomware|hacker|start-?up|satelit|spatial|nasa|cercetator|5g|internet|date personale|algoritm|cip)/g],
  ["sanatate", /\b(spital|medic|pacient|boal|vaccin|grip|cancer|sanatat|tratament|urgent|chirurg|medicament|epidemi|virus)/g],
  ["auto", /\b(masin|autoturism|autovehicul|\bauto\b|autostrad|drum|trafic|sofer|rovinieta|permis|dacia|inmatricul|electrice|benzin|motorin)/g],
  ["cultura", /\b(film|festival|teatru|carte|muzeu|expozit|concert|opera|scriitor|cinema|tiff|spectacol|premier[aă] (filmului|spectacolului)|literatur)/g],
  ["lifestyle", /\b(vacant|calator|turism|turist|retet|gastronom|moda|gradin|munte|litoral|revelion|hotel|pensiun|sejur)/g],
  ["monden", /\b(vedet|actrit|actor|cantaret|nunt|divort|showbiz|gala|influencer|celebr|logodn)/g],
];
type CategorySlugLite = "politica" | "economie" | "sport" | "tech" | "sanatate" | "auto" | "cultura" | "lifestyle" | "monden";

/**
 * Clasificare de rezervă după cuvinte-cheie, pentru articolele venite din fluxuri generale
 * (fără secțiune). Întoarce „international” dacă textul e despre alt stat, altfel categoria
 * cu cele mai multe potriviri sau undefined (rămâne „național”). Redactorul AI rafinează ulterior.
 */
export function classifyCategory(titles: string[], summaries: string[]): string | undefined {
  const t = fold(titles.join(" "));
  const s = fold(summaries.join(" ").slice(0, 3000));
  // Știre externă: majoritatea titlurilor vorbesc despre alt stat/regiune.
  const withRegion = titles.filter((x) => detectRegion(x)).length;
  if (withRegion > 0 && withRegion * 2 >= titles.length) return "international";
  let best: { cat: string; score: number } | undefined;
  for (const [cat, re] of CATEGORY_RULES) {
    const inTitle = new Set(t.match(re) ?? []).size;
    const inBody = new Set(s.match(re) ?? []).size;
    const score = inTitle * 2 + inBody;
    if (score >= 3 && (!best || score > best.score)) best = { cat, score };
  }
  return best?.cat;
}
