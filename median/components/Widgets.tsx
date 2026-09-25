"use client";

import { Activity, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Droplets, Moon, Sun, Wind } from "lucide-react";
import { useState } from "react";
import type { CityWeather, Quake, RatesData } from "@/lib/widgets";
import { cx } from "@/lib/utils";
import { TimeAgo } from "./TimeAgo";

function WeatherIcon({ code, isDay = true, className }: { code: number; isDay?: boolean; className?: string }) {
  const I =
    code === 0 ? (isDay ? Sun : Moon) :
    code <= 2 ? (isDay ? CloudSun : CloudMoon) :
    code === 3 ? Cloud :
    code <= 48 ? CloudFog :
    code <= 57 ? CloudDrizzle :
    code <= 67 || (code >= 80 && code <= 82) ? CloudRain :
    code <= 77 || code <= 86 ? CloudSnow :
    CloudLightning;
  return <I className={className} strokeWidth={1.6} />;
}

function label(code: number): string {
  if (code === 0) return "Senin";
  if (code <= 2) return "Parțial noros";
  if (code === 3) return "Înnorat";
  if (code <= 48) return "Ceață";
  if (code <= 57) return "Burniță";
  if (code <= 67) return "Ploaie";
  if (code <= 77) return "Ninsoare";
  if (code <= 82) return "Averse";
  if (code <= 86) return "Averse de ninsoare";
  return "Furtună";
}

const DAY = new Intl.DateTimeFormat("ro-RO", { weekday: "short", timeZone: "Europe/Bucharest" });

export function WeatherWidget({ data }: { data: CityWeather[] }) {
  const [i, setI] = useState(0);
  const w = data[i];
  const warm = w.temp >= 20;
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-5 text-white"
      style={{ background: w.isDay ? (warm ? "linear-gradient(145deg,#ff9a3c,#ff5f6d 55%,#7b4dff)" : "linear-gradient(145deg,#4facfe,#3a2bff)") : "linear-gradient(145deg,#1d2671,#3a2bff 60%,#6a3093)" }}
    >
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="flex items-start justify-between">
        <div>
          <select
            value={i}
            onChange={(e) => setI(Number(e.target.value))}
            className="-ml-1 cursor-pointer appearance-none rounded-lg bg-transparent px-1 text-sm font-semibold outline-none hover:bg-white/10 [&>option]:text-black"
            aria-label="Alege orașul"
          >
            {data.map((c, j) => (
              <option key={c.city} value={j}>
                {c.city} ▾
              </option>
            ))}
          </select>
          <div className="mt-1 font-display text-6xl font-bold leading-none tabular-nums">{w.temp}°</div>
          <div className="mt-1 text-sm text-white/85">
            {label(w.code)} · se simte ca {w.feels}°
          </div>
        </div>
        <WeatherIcon code={w.code} isDay={w.isDay} className="h-16 w-16 drop-shadow-lg" />
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-white/80">
        <span className="inline-flex items-center gap-1"><Wind className="h-3.5 w-3.5" /> {w.wind} km/h</span>
        <span className="inline-flex items-center gap-1"><Droplets className="h-3.5 w-3.5" /> {w.daily[0]?.rain ?? 0}%</span>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-white/20 pt-4">
        {w.daily.map((d, j) => (
          <div key={d.date} className="text-center text-xs">
            <div className="font-semibold capitalize text-white/85">{j === 0 ? "Azi" : DAY.format(new Date(d.date + "T12:00:00Z"))}</div>
            <WeatherIcon code={d.code} className="mx-auto my-1.5 h-6 w-6" />
            <div className="tabular-nums"><b>{d.max}°</b> <span className="text-white/65">{d.min}°</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 64},${20 - ((v - min) / span) * 18 - 1}`).join(" ");
  return (
    <svg viewBox="0 0 64 20" className="h-5 w-16" aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? "var(--breaking)" : "var(--live)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAMES: Record<string, string> = { EUR: "Euro", USD: "Dolar american", GBP: "Liră sterlină", CHF: "Franc elvețian", HUF: "Forint (1)", MDL: "Leu moldovenesc", XAU: "Aur (gram)" };

export function RatesWidget({ data }: { data: RatesData }) {
  return (
    <div id="curs" className="scroll-mt-32 rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-lg font-bold">Curs valutar BNR</h3>
        <span className="text-xs text-ink-muted">{new Date(data.date + "T12:00:00Z").toLocaleDateString("ro-RO", { day: "numeric", month: "long", timeZone: "Europe/Bucharest" })}</span>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {data.rates.map((r) => {
          const diff = r.prev ? r.value - r.prev : 0;
          const up = diff > 0;
          return (
            <li key={r.code} className="flex items-center gap-3 py-2.5">
              <span className="w-11 rounded-md bg-surface-2 py-1 text-center text-xs font-bold">{r.code}</span>
              <span className="hidden flex-1 truncate text-xs text-ink-muted sm:block">{NAMES[r.code]}</span>
              <span className="flex-1 sm:hidden" />
              <Sparkline values={r.history} up={up} />
              <span className="w-20 text-right font-semibold tabular-nums">{r.value.toFixed(r.value > 100 ? 2 : 4)}</span>
              <span className={cx("w-14 text-right text-xs tabular-nums", diff === 0 ? "text-ink-faint" : up ? "text-breaking" : "text-live")}>
                {diff === 0 ? "—" : `${up ? "▲" : "▼"} ${Math.abs(diff).toFixed(r.value > 100 ? 2 : 4)}`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-ink-faint">Sursa: Banca Națională a României</p>
    </div>
  );
}

export function QuakesWidget({ data }: { data: Quake[] }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-breaking" />
        <h3 className="font-display text-lg font-bold">Cutremure recente</h3>
      </div>
      {data.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">Niciun seism peste 2,5 în ultimele 30 de zile. 🙂</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {data.slice(0, 5).map((q) => (
            <li key={q.id}>
              <a href={q.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm hover:text-brand">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: q.mag >= 4.5 ? "var(--breaking)" : q.mag >= 3.5 ? "#F97316" : "#0891B2" }}
                >
                  {q.mag.toFixed(1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 font-medium">{q.place}</span>
                  <span className="text-xs text-ink-muted">
                    <TimeAgo ts={q.time} /> · {q.depth} km adâncime
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-ink-faint">Sursa: USGS</p>
    </div>
  );
}
