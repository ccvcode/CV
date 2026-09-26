import Link from "next/link";
import { LEVEL_NAME, type QuakeEvent, type WeatherAlert } from "@/lib/data/alerts";
import { formatDate, timeAgo } from "@/lib/core/utils";

function countiesLabel(c: string[]) {
  if (!c.length) return "";
  if (c.length > 4) return `${c.length} județe`;
  return c.join(", ");
}

/**
 * Banda de alerte de sub antet: cea mai gravă avertizare ANM în vigoare și cutremurele notabile.
 * Nu apare deloc când nu e nimic de semnalat.
 */
export function AlertsStrip({ weather, quakes }: { weather: WeatherAlert[]; quakes: QuakeEvent[] }) {
  if (!weather.length && !quakes.length) return null;
  const top = weather[0];
  const more = weather.length - 1;
  const q = quakes[0];
  return (
    <div className="mx-auto max-w-[1320px] px-4 sm:px-8">
      <Link href="/alerte" className="ui group flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-rule py-2 text-[13px]">
        <span className="kicker text-ink-2">Alerte</span>
        {top && (
          <span className="flex min-w-0 items-center gap-2">
            <span className={`lvl lvl-${top.level}`} aria-hidden />
            <b className="font-semibold">Cod {LEVEL_NAME[top.level]}</b>
            <span className="truncate text-ink-2">
              {[top.phenomena || top.title, top.interval, countiesLabel(top.counties)].filter(Boolean).join(" · ")}
            </span>
            {more > 0 && <span className="shrink-0 text-ink-3">+{more}</span>}
          </span>
        )}
        {q && (
          <span className="flex items-center gap-2">
            <span className="lvl lvl-q" aria-hidden />
            <b className="font-semibold">Cutremur {q.mag.toFixed(1).replace(".", ",")}</b>
            <span className="text-ink-2" suppressHydrationWarning>
              {q.place} · {q.depth} km · {timeAgo(q.time)}
            </span>
          </span>
        )}
        <span className="ml-auto text-ink-3 group-hover:text-ink group-hover:underline">Detalii →</span>
      </Link>
    </div>
  );
}

export function WeatherAlertCard({ a }: { a: WeatherAlert }) {
  return (
    <article className="border-t border-rule py-5">
      <div className="ui flex items-center gap-2 text-[13px]">
        <span className={`lvl lvl-${a.level}`} aria-hidden />
        <b className="font-semibold uppercase tracking-wide">Cod {LEVEL_NAME[a.level]}</b>
        <span className="text-ink-3">{a.kind === "nowcasting" ? "avertizare imediată" : "avertizare ANM"}</span>
      </div>
      <h3 className="hl mt-2 text-[22px] leading-tight">{a.phenomena || a.title}</h3>
      <p className="ui mt-1 text-[14px] text-ink-2">
        {a.interval}
        {a.counties.length > 0 && <> · {a.counties.join(", ")}</>}
      </p>
      {a.text && <p className="mt-3 max-w-3xl text-[17px] leading-relaxed">{a.text}</p>}
    </article>
  );
}

export function QuakeTable({ quakes }: { quakes: QuakeEvent[] }) {
  return (
    <table className="ui mt-3 w-full text-[14px]">
      <thead>
        <tr className="kicker border-b border-rule text-left text-ink-3">
          <th className="py-2 font-bold">Magnitudine</th>
          <th className="py-2 font-bold">Zona</th>
          <th className="hidden py-2 text-right font-bold sm:table-cell">Adâncime</th>
          <th className="py-2 text-right font-bold">Ora</th>
        </tr>
      </thead>
      <tbody>
        {quakes.map((q) => (
          <tr key={q.id} className="border-b border-rule">
            <td className="py-2.5">
              <a href={q.url} target="_blank" rel="noopener noreferrer" className={`mono font-semibold hover:underline ${q.mag >= 4 ? "text-accent-ink" : ""}`}>
                {q.mag.toFixed(1).replace(".", ",")}
              </a>
            </td>
            <td className="py-2.5">{q.place}</td>
            <td className="mono hidden py-2.5 text-right text-ink-2 sm:table-cell">{q.depth} km</td>
            <td className="mono py-2.5 text-right text-ink-2" suppressHydrationWarning>
              {formatDate(q.time)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
