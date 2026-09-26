import { XMLParser } from "fast-xml-parser";
import { decodeEntities } from "../core/utils";
import { fold } from "../pipeline/text";

/*
 * Alerte oficiale: avertizările ANM (meteoromania.ro, fluxurile XML publice) și cutremurele din zona
 * României (EMSC, care preia datele INFP). Folosit de site (bandă + pagina /alerte) și de worker
 * (notificări). Rezultatele stau 5 minute în memorie, ca să nu cerem aceleași date la fiecare pagină.
 */

export type AlertLevel = 1 | 2 | 3; // galben, portocaliu, roșu
export const LEVEL_NAME: Record<AlertLevel, string> = { 1: "galben", 2: "portocaliu", 3: "roșu" };

export interface WeatherAlert {
  id: string;
  kind: "general" | "nowcasting";
  level: AlertLevel;
  title: string;
  interval: string;
  phenomena: string;
  text: string;
  counties: string[];
  start?: number;
  end?: number;
}

export interface QuakeEvent {
  id: string;
  mag: number;
  depth: number;
  time: number;
  place: string;
  lat: number;
  lon: number;
  url: string;
  source: string;
}

/** Codurile județelor din fluxul ANM → nume. */
export const COUNTIES: Record<string, string> = {
  AB: "Alba", AR: "Arad", AG: "Argeș", BC: "Bacău", BH: "Bihor", BN: "Bistrița-Năsăud", BT: "Botoșani", BV: "Brașov", BR: "Brăila",
  B: "București", BZ: "Buzău", CS: "Caraș-Severin", CL: "Călărași", CJ: "Cluj", CT: "Constanța", CV: "Covasna", DB: "Dâmbovița",
  DJ: "Dolj", GL: "Galați", GR: "Giurgiu", GJ: "Gorj", HR: "Harghita", HD: "Hunedoara", IL: "Ialomița", IS: "Iași", IF: "Ilfov",
  MM: "Maramureș", MH: "Mehedinți", MS: "Mureș", NT: "Neamț", OT: "Olt", PH: "Prahova", SM: "Satu Mare", SJ: "Sălaj", SB: "Sibiu",
  SV: "Suceava", TR: "Teleorman", TM: "Timiș", TL: "Tulcea", VS: "Vaslui", VL: "Vâlcea", VN: "Vrancea",
};

const UA = "Mozilla/5.0 (compatible; MedianBot/2.0; +https://median.ro/despre)";
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function getText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": UA }, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function htmlToLines(html: string): string[] {
  return decodeEntities(decodeEntities(html))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Culoarea unei avertizări: din text („COD PORTOCALIU”), din imaginile hărții sau din atribut. */
function levelOf(attrs: Record<string, string>, html: string): AlertLevel {
  const named = fold(`${attrs.numeCuloare ?? ""} ${attrs.numeTipMesaj ?? ""} ${html}`);
  if (/\b(cod )?rosu\b|rosu\.png/.test(named)) return 3;
  if (/\b(cod )?portocaliu\b|portocaliu\.png/.test(named)) return 2;
  if (/\b(cod )?galben\b|galben\.png/.test(named)) return 1;
  // În fluxul general, atributul „culoare” e 0 = galben, 1 = portocaliu, 2 = roșu.
  const c = Number(attrs.culoare);
  return c >= 2 ? 3 : c === 1 ? 2 : 1;
}

const RO_DATE = /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/;
function parseDate(s?: string): number | undefined {
  const m = s ? RO_DATE.exec(s) : null;
  if (!m) return undefined;
  // Orele ANM sunt ora României; aproximăm diferența (UTC+3 vara, UTC+2 iarna) după lună.
  const month = Number(m[2]);
  const offset = month >= 4 && month <= 10 ? 3 : 2;
  return Date.UTC(Number(m[1]), month - 1, Number(m[3]), Number(m[4]) - offset, Number(m[5]));
}

export function parseAnm(xml: string, kind: WeatherAlert["kind"]): WeatherAlert[] {
  const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", isArray: (n, _p, _leaf, isAttr) => !isAttr && ["avertizare", "judet", "zona"].includes(n) }).parse(xml);
  const root = doc.avertizari ?? doc.avertizariNowcasting ?? {};
  const list: Record<string, unknown>[] = root.avertizare ?? [];
  const out: WeatherAlert[] = [];
  list.forEach((el, i) => {
    const attrs = Object.fromEntries(Object.entries(el).filter(([k]) => k.startsWith("@_")).map(([k, v]) => [k.slice(2), String(v)]));
    const html = attrs.mesaj ?? attrs.semnalare ?? "";
    const lines = htmlToLines(html);
    const pick = (label: RegExp) => lines.find((l) => label.test(fold(l)))?.replace(/^[^:]+:\s*/, "") ?? "";
    // Județele: copiii <judet cod="XX" culoare="N"/> (N > 0) sau atributul „judet” din nowcasting.
    const judete = (Array.isArray(el.judet) ? (el.judet as Record<string, string | number>[]) : [])
      .filter((j) => j["@_cod"] && Number(j["@_culoare"] ?? 1) > 0)
      .map((j) => COUNTIES[String(j["@_cod"])] ?? String(j["@_cod"]));
    const attrCounties = (attrs.judet ?? "").split(/[,;\s]+/).filter(Boolean).map((c) => COUNTIES[c] ?? c);
    const text = lines.filter((l) => !/^(interval de valabilitate|fenomene vizate)/.test(fold(l))).join(" ");
    const level = levelOf(attrs, html);
    const interval = attrs.intervalul || pick(/^interval de valabilitate/) || [attrs.dataInceput, attrs.dataSfarsit].filter(Boolean).join(" – ");
    out.push({
      id: `${kind}:${fold(`${attrs.numeTipMesaj ?? ""}|${interval}|${attrs.zona ?? ""}|${i}`).replace(/[^a-z0-9|]+/g, "-")}`,
      kind,
      level,
      title: kind === "nowcasting" ? `Cod ${LEVEL_NAME[level]} imediat${attrs.zona ? ` · ${attrs.zona}` : ""}` : attrs.numeTipMesaj || `Cod ${LEVEL_NAME[level]}`,
      interval,
      phenomena: pick(/^fenomene vizate/) || attrs.tipMesaj || "",
      text: kind === "nowcasting" ? lines.join(" ") : text,
      counties: [...new Set([...judete, ...attrCounties])],
      start: parseDate(attrs.dataInceput),
      end: parseDate(attrs.dataSfarsit),
    });
  });
  return out;
}

/** Avertizările ANM în vigoare (generale + imediate), cele mai grave primele. */
export async function getWeatherAlerts(): Promise<WeatherAlert[]> {
  return cached("anm", 5 * 60_000, async () => {
    const [general, now] = await Promise.all([
      getText("https://www.meteoromania.ro/avertizari-xml.php").then((x) => parseAnm(x, "general")).catch(() => []),
      getText("https://www.meteoromania.ro/avertizari-nowcasting-xml.php").then((x) => parseAnm(x, "nowcasting")).catch(() => []),
    ]);
    const t = Date.now();
    return [...general, ...now.filter((a) => !a.end || a.end > t)].sort((a, b) => b.level - a.level);
  });
}

const PLACE: Record<string, string> = { ROMANIA: "România", UKRAINE: "Ucraina", MOLDOVA: "R. Moldova", BULGARIA: "Bulgaria", SERBIA: "Serbia", HUNGARY: "Ungaria" };

/** Cutremure din zona României (EMSC/INFP), cele mai noi primele. */
export async function getQuakes(opts: { days?: number; minMag?: number } = {}): Promise<QuakeEvent[]> {
  const days = opts.days ?? 7;
  const minMag = opts.minMag ?? 2.5;
  return cached(`quakes:${days}:${minMag}`, 5 * 60_000, async () => {
    const start = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 19);
    const url =
      `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minlat=43.5&maxlat=48.3&minlon=20.2&maxlon=29.8` +
      `&minmag=${minMag}&starttime=${start}&orderby=time&limit=50`;
    try {
      const data = JSON.parse(await getText(url)) as {
        features: { id: string; properties: { unid: string; mag: number; depth: number; time: string; flynn_region: string; lat: number; lon: number; auth: string } }[];
      };
      return data.features.map((f) => {
        const p = f.properties;
        const region = p.flynn_region ?? "";
        return {
          id: p.unid ?? f.id,
          mag: Math.round(p.mag * 10) / 10,
          depth: Math.round(p.depth),
          time: Date.parse(p.time),
          place: region === "ROMANIA" && p.lat > 45.4 && p.lat < 46.1 && p.lon > 26.2 && p.lon < 27.2 ? "Vrancea, România" : PLACE[region] ?? region.charAt(0) + region.slice(1).toLowerCase(),
          lat: p.lat,
          lon: p.lon,
          url: `https://www.seismicportal.eu/eventdetails.html?unid=${encodeURIComponent(p.unid ?? f.id)}`,
          source: p.auth === "NIEP" ? "INFP" : p.auth,
        };
      });
    } catch {
      return [];
    }
  });
}

/** Ce merită o bandă pe site: avertizări ANM și cutremure semnificative recente. */
export async function activeAlerts(): Promise<{ weather: WeatherAlert[]; quakes: QuakeEvent[] }> {
  const [weather, quakes] = await Promise.all([getWeatherAlerts().catch(() => []), getQuakes({ days: 2, minMag: 3 }).catch(() => [])]);
  const t = Date.now();
  // Cutremur „de bandă”: M≥4 în ultimele 24 de ore sau M≥3 în ultimele 6 ore, în România.
  const notable = quakes.filter((q) => q.place.includes("România") && ((q.mag >= 4 && t - q.time < 86400_000) || (q.mag >= 3 && t - q.time < 6 * 3600_000)));
  return { weather, quakes: notable };
}
