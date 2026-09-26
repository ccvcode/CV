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

/** Nume proprii din titlu (cuvinte cu majusculă care nu încep propoziția) — ajută gruparea. */
export function entities(title: string): string[] {
  const words = title.replace(/[„”"«»:;,.!?()]/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  words.forEach((w, i) => {
    if (i === 0) return;
    if (/^[A-ZĂÂÎȘŞȚŢ][a-zăâîșşțţ]{2,}/.test(w) || /^[A-Z]{2,6}$/.test(w)) out.add(fold(w).slice(0, 6));
  });
  return [...out];
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
  ["ucraina", /\b(ucrain|kiev|kyiv|zelenski|zelensky|rusia|rusiei|rusesc|ruse\b|rusi\b|putin\b|kremlin|moscov|donbas|harkov|odesa|crimeea|nato)/],
  ["moldova", /\b(moldov|chisinau|sandu|transnistr|gagauz)/],
  ["orientul-mijlociu", /\b(israel|gaza|hamas|hezbollah|liban|iran|teheran|siria|irak|yemen|houthi|saudit|netanyahu|cisiordani|palestin)/],
  ["sua", /\b(sua\b|statele unite|washington|trump|casa alba|pentagon|congres|senatul american|new york|california|biden|vance|americani)/],
  ["asia", /\b(china|beijing|taiwan|japoni|tokyo|coreea|phenian|seul|india\b|pakistan|afganistan|indonezi|vietnam|filipin)/],
  ["europa", /\b(ue\b|uniunea europeana|bruxelles|comisia europeana|parlamentul european|germani|berlin|franta|paris|macron|merz|itali|spani|polon|ungari|orban|bulgari|serbi|grecia|austri|olanda|belgia|marea britanie|londra|europe)/],
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
