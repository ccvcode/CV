import "server-only";
import { XMLParser } from "fast-xml-parser";

export interface Rate {
  code: string;
  value: number;
  prev?: number;
  history: number[];
}

export interface RatesData {
  date: string;
  rates: Rate[];
}

const WANTED = ["EUR", "USD", "GBP", "CHF", "HUF", "MDL", "XAU"];

async function getText(url: string, revalidate: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { next: { revalidate }, signal: ctrl.signal, headers: { "user-agent": "MedianBot/1.0" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/** Cursul BNR (ultimele 10 zile), pentru widget și sparkline. */
export async function getRates(): Promise<RatesData | null> {
  const xml = await getText("https://curs.bnr.ro/nbrfxrates10days.xml", 3600).catch(() =>
    getText("https://www.bnr.ro/nbrfxrates10days.xml", 3600).catch(() => null)
  );
  if (!xml) return null;
  try {
    const doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", isArray: (n) => n === "Cube" || n === "Rate" }).parse(xml);
    const cubes: { "@_date": string; Rate: ({ "#text": string; "@_currency": string; "@_multiplier"?: string } | string)[] }[] =
      doc.DataSet.Body.Cube;
    const days = [...cubes].sort((a, b) => a["@_date"].localeCompare(b["@_date"]));
    const series: Record<string, number[]> = {};
    for (const d of days) {
      for (const r of d.Rate) {
        if (typeof r !== "object") continue;
        const code = r["@_currency"];
        if (!WANTED.includes(code)) continue;
        const v = parseFloat(r["#text"]) / (r["@_multiplier"] ? parseFloat(r["@_multiplier"]) : 1);
        (series[code] ??= []).push(v);
      }
    }
    const rates = WANTED.filter((c) => series[c]?.length).map((code) => {
      const h = series[code];
      return { code, value: h[h.length - 1], prev: h[h.length - 2], history: h };
    });
    return { date: days[days.length - 1]["@_date"], rates };
  } catch {
    return null;
  }
}

export interface CityWeather {
  city: string;
  temp: number;
  feels: number;
  code: number;
  isDay: boolean;
  wind: number;
  daily: { date: string; code: number; max: number; min: number; rain: number }[];
}

export const CITIES = [
  { name: "București", lat: 44.43, lon: 26.1 },
  { name: "Cluj-Napoca", lat: 46.77, lon: 23.6 },
  { name: "Iași", lat: 47.16, lon: 27.59 },
  { name: "Timișoara", lat: 45.75, lon: 21.23 },
  { name: "Constanța", lat: 44.18, lon: 28.63 },
  { name: "Brașov", lat: 45.66, lon: 25.61 },
  { name: "Craiova", lat: 44.32, lon: 23.8 },
];

interface OMResponse {
  current: { temperature_2m: number; apparent_temperature: number; weather_code: number; is_day: number; wind_speed_10m: number };
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[] };
}

export async function getWeather(): Promise<CityWeather[] | null> {
  const lat = CITIES.map((c) => c.lat).join(",");
  const lon = CITIES.map((c) => c.lon).join(",");
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FBucharest&forecast_days=4`;
  try {
    const raw = JSON.parse(await getText(url, 900)) as OMResponse | OMResponse[];
    const list = Array.isArray(raw) ? raw : [raw];
    return list.map((r, i) => ({
      city: CITIES[i].name,
      temp: Math.round(r.current.temperature_2m),
      feels: Math.round(r.current.apparent_temperature),
      code: r.current.weather_code,
      isDay: r.current.is_day === 1,
      wind: Math.round(r.current.wind_speed_10m),
      daily: r.daily.time.map((d, j) => ({
        date: d,
        code: r.daily.weather_code[j],
        max: Math.round(r.daily.temperature_2m_max[j]),
        min: Math.round(r.daily.temperature_2m_min[j]),
        rain: r.daily.precipitation_probability_max[j] ?? 0,
      })),
    }));
  } catch {
    return null;
  }
}

export interface Quake {
  id: string;
  mag: number;
  place: string;
  time: number;
  depth: number;
  url: string;
}

/** Cutremure recente în zona României (USGS, magnitudine ≥ 2.5, ultimele 30 de zile). */
export async function getQuakes(): Promise<Quake[] | null> {
  const start = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const url =
    `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}` +
    `&minlatitude=43.5&maxlatitude=48.3&minlongitude=20.2&maxlongitude=29.7&minmagnitude=2.5&orderby=time&limit=6`;
  try {
    const data = JSON.parse(await getText(url, 900)) as {
      features: { id: string; properties: { mag: number; place: string | null; time: number; url: string }; geometry: { coordinates: number[] } }[];
    };
    return data.features.map((f) => ({
      id: f.id,
      mag: f.properties.mag,
      place: (f.properties.place ?? "Zona României").replace(/, Romania$/, ""),
      time: f.properties.time,
      depth: Math.round(f.geometry.coordinates[2]),
      url: f.properties.url,
    }));
  } catch {
    return null;
  }
}
