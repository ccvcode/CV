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
  // Doar cifrele distinctive confirmă (sume, procente cu zecimale, numere de ≥3 cifre), nu anii sau zilele.
  for (const m of (title + " " + lead.slice(0, 400)).matchAll(/\d+(?:[.,]\d+)?/g)) {
    const v = m[0];
    if (/^(19|20)\d\d$/.test(v)) continue;
    if (/[.,]/.test(v) || v.length >= 3) numbers.add(v.replace(",", "."));
  }
  return { terms, entities: new Set([...entities(title), ...entities(lead.slice(0, 400))]), numbers };
}

/**
 * Decizia „același subiect”: similaritate mare, sau similaritate moderată confirmată de cel puțin
 * un nume propriu sau o cifră comună (evită grupările pe cuvinte generice precum „au crescut”).
 */
/*
 * Nume proprii care apar în știri fără legătură între ele: țări și blocuri mari, agenții de presă,
 * publicații, rețele sociale. Nu confirmă că două articole descriu același eveniment
 * (ex. „o insectă din SUA, citată de AFP” ≠ „Iranul trimite SUA o propunere, relatează AFP”).
 * Forma e cea din `entities()`: fiecare cuvânt fără diacritice, tăiat la 6 litere.
 */
export const GENERIC_ENTITIES = new Set(
  (
    "sua|statel unite|americ|romani|europa|europe|uniune europe|ue|nato|onu|rusia|rusiei|rusa|federa rusa|ucrain|china|chinei|" +
    "german|franta|frante|italia|italie|spania|spanie|marea britan|regatu unit|ungari|bulgar|poloni|turcia|turcie|israel|" +
    "iran|iranul|moldov|republ moldov|" +
    "bucure|washin|moscov|kiev|beijin|bruxel|londra|paris|berlin|" +
    "afp|reuter|ap|associ press|agerpr|mediaf|news ro|efe|dpa|ansa|tass|ria novost|cnn|bbc|wsj|wall street journa|" +
    "new york times|bloomb|politi|guardi|financ times|digi24|hotnew|g4medi|antena|protv|" +
    "facebo|instag|tiktok|youtub|truth social|x|twitte"
  ).split("|")
);

export function sameStory(a: DocVector, b: DocVector, idf: (t: string) => number): { same: boolean; score: number } {
  const score = similarity(a, b, idf);
  if (score >= 0.36) return { same: true, score };
  if (score < 0.2) return { same: false, score };
  // Numele proprii foarte frecvente („România”, „Guvernul”) sau generice (țări, agenții) nu confirmă nimic.
  for (const e of a.entities) if (b.entities.has(e) && idf(e) >= 2.2 && !GENERIC_ENTITIES.has(e)) return { same: true, score };
  for (const n of a.numbers) if (b.numbers.has(n)) return { same: true, score };
  return { same: false, score };
}

/**
 * Ordonează articolele unui subiect după cât de „centrale” sunt: media similarității cu celelalte.
 * Primul este cel mai reprezentativ pentru subiect (titlul și poza de lucru vin de la el), astfel
 * încât un articol prins la marginea grupului să nu dea titlul sau poza întregului subiect.
 * La egalitate: publicațiile de nivel 1, apoi cel mai vechi.
 */
export function byCentrality<T extends { title: string; summary: string; tier: number; published_at: number }>(items: T[]): T[] {
  if (items.length < 3) return [...items].sort((a, b) => a.tier - b.tier || a.published_at - b.published_at);
  const vecs = items.map((i) => docVector(i.title, i.summary));
  const one = () => 1;
  const score = items.map((_, i) => {
    let sum = 0;
    for (let j = 0; j < items.length; j++) if (j !== i) sum += similarity(vecs[i], vecs[j], one);
    // Titlurile foarte lungi (un rezumat întreg pus în titlu) nu sunt bune ca titlu al subiectului.
    return sum / (items.length - 1) - Math.max(0, items[i].title.length - 110) * 0.002;
  });
  return items
    .map((it, i) => ({ it, s: score[i] }))
    .sort((a, b) => b.s - a.s + (a.it.tier - b.it.tier) * 0.02 || a.it.published_at - b.it.published_at)
    .map((x) => x.it);
}

/**
 * Numele proprii dintr-un titlu, în forma originală (pentru căutări Wikidata/Commons fără AI):
 * secvențe de 2–4 cuvinte cu majusculă, sau un singur cuvânt care nu e la început de propoziție.
 * Numele generice (țări, agenții, publicații) sunt excluse.
 */
export function properNames(title: string): string[] {
  const out: string[] = [];
  const tokens = title.replace(/[„”"«»:;,.!?()[\]|/–—-]/g, " | ").split(/\s+/).filter(Boolean);
  let cur: string[] = [];
  let curStart = false;
  let sentenceStart = true;
  const flush = () => {
    while (cur.length && /^(de|din|și|si)$/i.test(cur[cur.length - 1])) cur.pop();
    const folded = cur.map((w) => fold(w).slice(0, 6)).join(" ");
    const acronym = cur.length === 1 && /^[A-ZĂÂÎȘŞȚŢ]{2,6}$/.test(cur[0]);
    const camel = cur.length === 1 && /^[A-ZĂÂÎȘŞȚŢ][a-zăâîșşțţ]+[A-Z]/.test(cur[0]);
    if (cur.length >= 2 || (cur.length === 1 && (!curStart || camel) && !acronym)) {
      if (!GENERIC_ENTITIES.has(folded) && cur.length <= 4) out.push(cur.join(" "));
    }
    // La început de propoziție, primul cuvânt poate fi unul obișnuit („Renovarea Turnului Eiffel”).
    if (curStart && cur.length >= 3) out.push(cur.slice(1).join(" "));
    cur = [];
  };
  for (const t of tokens) {
    if (t === "|") {
      if (cur.length) flush();
      sentenceStart = true;
      continue;
    }
    const cap = /^[A-ZĂÂÎȘŞȚŢ][a-zăâîșşțţ]+([A-Z][a-z]+)?(-[A-ZĂÂÎȘŞȚŢ][a-zăâîșşțţ]+)?$/.test(t) || /^[A-ZĂÂÎȘŞȚŢ]{2,6}$/.test(t);
    if (cap || (cur.length && /^(de|din)$/.test(t))) {
      if (!cur.length) curStart = sentenceStart;
      cur.push(t);
    } else if (cur.length) flush();
    sentenceStart = false;
  }
  if (cur.length) flush();
  return [...new Set(out)];
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
  for (const e of a.entities) if (b.entities.has(e) && !GENERIC_ENTITIES.has(e)) sharedEnt++;
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
  // Atenție la cuvintele românești care seamănă: „puțin” → „putin”, „Ruse” (Gabriela Ruse, Giurgiu–Ruse).
  ["ucraina", /\b(ucrain|kiev|kyiv|zelenski|zelensky|rusia|rusiei|rusesc|(armat|forte|trupe|drone|rachete|atacuri)\w* ruse\b|vladimir putin|lui putin|putin (a|i|spune|sustine|anunta|afirma|avertizeaza)\b|kremlin|moscov|donbas|harkov|odesa|crimeea)/g],
  ["moldova", /\b(moldov|chisinau|ungheni|maia sandu|presedint[ae]i? sandu|transnistr|gagauz)/g],
  ["orientul-mijlociu", /\b(israel|gaza|hamas|hezbollah|liban|iran|teheran|siria|irak|yemen|houthi|saudit|netanyahu|cisiordani|palestin)/g],
  ["sua", /\b(sua\b|statele unite|washington|trump|casa alba|pentagon|congresul american|congresul sua|senatul american|new york|california|biden|vance|americani)/g],
  ["asia", /\b(china|beijing|taiwan|japoni|tokyo|coreea|phenian|seul|india\b|pakistan|afganistan|indonezi|vietnam|filipin)/g],
  ["europa", /\b(ue\b|uniunea europeana|bruxelles|comisia europeana|parlamentul european|germani|berlin|franta|paris|macron|merz|itali|spani|polon|ungari|viktor orban|bulgari|serbi|greci|atena|atenei|acropol|lisabona|portugalia|madrid|viena|varsovia|praga|cehi|slovaci|croati|norvegi|danemarca|finlanda|irlanda|elvetia|olandez|amsterdam|austri|olanda|belgia|marea britanie|londra|europa\b|zona euro)/g],
];

/** Regiunea cu cele mai multe mențiuni distincte (nu prima găsită: o singură mențiune a Rusiei nu face o știre „Ucraina”). */
export function detectRegion(text: string): RegionSlug | undefined {
  const t = fold(text);
  let best: { slug: RegionSlug; n: number } | undefined;
  for (const [slug, re] of REGIONS) {
    const n = new Set(t.match(re) ?? []).size;
    if (n && (!best || n > best.n)) best = { slug, n };
  }
  return best?.slug;
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
  // „AI” se numără separat, cu majuscule („ai” e și verbul „a avea”); „cip” ar prinde „Ciprian”.
  ["tech", /\b(inteligenta artificiala|openai|chatgpt|software|aplicati|smartphone|cibernetic|ransomware|hacker|satelit|spatial|nasa|cercetator|5g|internet|date personale|algoritm|cipuri|cipul|semiconductor)/g],
  ["sanatate", /\b(spital|medic|pacient|boal|vaccin|grip|cancer|sanatat|tratament|urgent|chirurg|medicament|epidemi|virus|alergi|raceal|simptom|nutritionist|diet[aei]\b|colesterol|diabet|tensiun)/g],
  ["auto", /\b(masin|autoturism|autovehicul|\bauto\b|rovinieta|permis(ul)? (auto|de conducere)|dacia|inmatricul|model(ul)? (electric|nou)|hibrid|motor(ul)?\b|recheama in service|salon auto)/g],
  ["cultura", /\b(film|festival|teatru|carte|muzeu|expozit|concert|opera|scriitor|cinema|tiff|spectacol|premier[aă] (filmului|spectacolului)|literatur)/g],
  ["lifestyle", /\b(vacant|turism|turist|retet|gastronom|moda\b|gradin|revelion|hotel|pensiun|sejur|horoscop|zodi|destinati|mic dejun|desert|prajitur|gatit|bucatari)/g],
  ["monden", /\b(vedet|actrit|actor|cantaret|nunt|divort|showbiz|gala|influencer|celebr|logodn)/g],
];
const GAMING =
  /\b(jocu(l|ri(le)?) video|gaming|gamer|playstation|ps5|xbox|nintendo|switch 2|steam\b|ea sports|ubisoft|rockstar games|gta ?(vi|6)|esports?|consol[aei] de jocuri|display(-uri)?\b|monitor(ul|ului|ae)? (de gaming|led|oled|portabil)|laptop|tablet[aei]\b|procesor|placa video|placi video|iphone|smartphone)/;

const GAME_SUMMARY = /\b(jocul|jocului|joc) (de actiune|de strategie|de fotbal|de rol|video|multiplayer)|\b(dezvoltator(ul)?|editor(ul)?) [^.]{0,40}\b(games|namco|ubisoft|sony|nintendo)/;

/** Știre despre jocuri video sau gadgeturi: majoritatea articolelor o spun explicit, în titlu sau în rezumat. */
export function isGaming(titles: string[], summaries: string[] = []): boolean {
  const hits = titles.filter((t, i) => {
    const ft = fold(t);
    return GAMING.test(ft) || /\bjocul saptamanii\b/.test(ft) || GAME_SUMMARY.test(fold((summaries[i] ?? "").slice(0, 600)));
  }).length;
  return hits > 0 && hits * 2 >= titles.length;
}

type CategorySlugLite = "politica" | "economie" | "sport" | "tech" | "sanatate" | "auto" | "cultura" | "lifestyle" | "monden";

/**
 * Clasificare de rezervă după cuvinte-cheie, pentru articolele venite din fluxuri generale
 * (fără secțiune). Întoarce „international” dacă textul e despre alt stat, altfel categoria
 * cu cele mai multe potriviri sau undefined (rămâne „național”). Redactorul AI rafinează ulterior.
 */
export function classifyCategory(titles: string[], summaries: string[]): string | undefined {
  const t = fold(titles.join(" "));
  const s = fold(summaries.join(" ").slice(0, 3000));
  // Știre externă: majoritatea titlurilor vorbesc despre alt stat/regiune și nu despre politica internă.
  const DOMESTIC = /\b(guvernul|guvern\b|parlament|senat\b|camera deputatilor|psd|pnl|usr|aur|udmr|primari|consiliul judetean|anaf|judetul|bucurest|isu\b|politia romana|horoscop|zodi)/;
  const withRegion = titles.filter((x) => detectRegion(x) && !DOMESTIC.test(fold(x))).length;
  if (withRegion > 0 && withRegion * 2 >= titles.length) return "international";
  // Horoscopul are termeni de sănătate, bani și dragoste: e mereu „Lifestyle”.
  if (/\b(horoscop|zodia|zodii|zodiac)/.test(t)) return "lifestyle";
  const aiMentions = (x: string) => (/\bAI\b/.test(x) ? 1 : 0);
  const scores: { cat: string; score: number; stems: number }[] = [];
  for (const [cat, re] of CATEGORY_RULES) {
    const tm = new Set(t.match(re) ?? []);
    const sm = new Set(s.match(re) ?? []);
    let score = tm.size * 2 + sm.size;
    let stems = new Set([...tm, ...sm]).size;
    if (cat === "tech") {
      score += aiMentions(titles.join(" ")) * 2 + aiMentions(summaries.join(" "));
      stems += aiMentions(titles.join(" ") + " " + summaries.join(" "));
    }
    scores.push({ cat, score, stems });
  }
  scores.sort((a, b) => b.score - a.score);
  const [best, second] = scores;
  // Cel puțin două cuvinte-cheie diferite, scor ≥3 și un avans față de a doua categorie.
  if (best && best.score >= 3 && best.stems >= 2 && best.score > (second?.score ?? 0)) return best.cat;
  return undefined;
}
