import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Moon, Sun, type LucideIcon } from "lucide-react";
import type { CityWeather } from "@/lib/data/widgets";

/** Codurile WMO (Open-Meteo) → descriere și iconiță. */
const CODES: [max: number, label: string, day: LucideIcon, night: LucideIcon][] = [
  [0, "senin", Sun, Moon],
  [2, "parțial noros", CloudSun, CloudMoon],
  [3, "înnorat", Cloud, Cloud],
  [48, "ceață", CloudFog, CloudFog],
  [57, "burniță", CloudDrizzle, CloudDrizzle],
  [67, "ploaie", CloudRain, CloudRain],
  [77, "ninsoare", CloudSnow, CloudSnow],
  [82, "averse", CloudRain, CloudRain],
  [86, "ninsoare", CloudSnow, CloudSnow],
  [99, "furtună", CloudLightning, CloudLightning],
];

export function weatherLabel(code: number): string {
  return (CODES.find(([c]) => code <= c) ?? CODES[CODES.length - 1])[1];
}

function Icon({ code, day = true, size = 18 }: { code: number; day?: boolean; size?: number }) {
  const row = CODES.find(([c]) => code <= c) ?? CODES[CODES.length - 1];
  const I = day ? row[2] : row[3];
  return <I size={size} strokeWidth={1.6} aria-hidden className="shrink-0" />;
}

const WEEKDAY = new Intl.DateTimeFormat("ro-RO", { weekday: "short", timeZone: "Europe/Bucharest" });

/**
 * Vremea, compact: Bucureștiul cu prognoza pe trei zile, apoi celelalte orașe pe un singur rând
 * (temperatura acum și maxima zilei). Pe telefon rândul se derulează orizontal.
 */
export function Weather({ cities }: { cities: CityWeather[] }) {
  const [main, ...rest] = cities;
  if (!main) return null;
  return (
    <section className="ui mt-16 border-y border-rule" aria-label="Vremea">
      <div className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:gap-0">
        <div className="flex items-center gap-4 lg:border-r lg:border-rule lg:pr-6">
          <div>
            <div className="kicker text-ink-2">Vremea</div>
            <div className="meta text-[11px]">{main.city}</div>
          </div>
          <div className="flex items-center gap-2">
            <Icon code={main.code} day={main.isDay} size={30} />
            <span className="mono text-[30px] font-medium leading-none">{main.temp}°</span>
          </div>
          <div className="text-[13px] leading-tight text-ink-2">
            <div>{weatherLabel(main.code)}</div>
            <div className="text-ink-3">se simte ca {main.feels}°</div>
          </div>
          <ol className="ml-auto flex gap-4 border-l border-rule pl-4 text-[12px] lg:ml-4">
            {main.daily.slice(1, 4).map((d) => (
              <li key={d.date} className="flex flex-col items-center gap-0.5" title={`${weatherLabel(d.code)}, ploaie ${d.rain}%`}>
                <span className="text-ink-3">{WEEKDAY.format(new Date(d.date + "T12:00:00Z")).replace(".", "")}</span>
                <Icon code={d.code} size={16} />
                <span className="mono">
                  {d.max}° <span className="text-ink-3">{d.min}°</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <ul className="no-scrollbar -mx-4 flex flex-1 gap-5 overflow-x-auto px-4 text-[13px] lg:mx-0 lg:justify-around lg:px-6">
          {rest.map((c) => (
            <li key={c.city} className="flex shrink-0 items-center gap-1.5" title={weatherLabel(c.code)}>
              <Icon code={c.code} day={c.isDay} size={16} />
              <span className="text-ink-2">{c.city}</span>
              <span className="mono font-medium">{c.temp}°</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
