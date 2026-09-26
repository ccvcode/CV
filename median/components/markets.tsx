import type { RatesData } from "@/lib/data/widgets";

const LABEL: Record<string, string> = { EUR: "Euro", USD: "Dolar SUA", GBP: "Liră sterlină", CHF: "Franc elvețian", MDL: "Leu moldovenesc", HUF: "Forint maghiar", XAU: "Aur (gram)" };
const fmt = (v: number, big: boolean) => v.toFixed(big ? 2 : 4).replace(".", ",");

/** Linie de tendință pe ultimele zile (o singură serie, în culoarea textului). */
export function Spark({ values, label, w = 72, h = 22 }: { values: number[]; label: string; w?: number; h?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 4) + 2, h - 3 - ((v - min) / span) * (h - 6)]);
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="shrink-0 text-ink-3">
      <title>{label}</title>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={h < 20 ? 2 : 2.5} className="fill-ink" />
    </svg>
  );
}

/**
 * Cursul BNR, compact: o bandă de 4 valute cu variația față de ziua precedentă și tendința pe
 * ultimele zile lucrătoare. Pe telefon devine un rând care se derulează orizontal.
 */
export function Markets({ rates, codes = ["EUR", "USD", "GBP", "XAU"] }: { rates: RatesData; codes?: string[] }) {
  const day = new Date(rates.date + "T12:00:00Z").toLocaleDateString("ro-RO", { day: "numeric", month: "long", timeZone: "Europe/Bucharest" });
  const list = codes.map((c) => rates.rates.find((r) => r.code === c)).filter((r): r is NonNullable<typeof r> => Boolean(r));
  return (
    <div className="ui mb-6 border-y border-rule">
      <div className="no-scrollbar -mx-4 flex overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex shrink-0 flex-col justify-center py-3 pr-6">
          <span className="kicker text-ink-2">Curs BNR</span>
          <span className="meta text-[11px]">{day}</span>
        </div>
        {list.map((r) => {
          const big = r.value > 100;
          const diff = r.prev != null ? r.value - r.prev : 0;
          const pct = r.prev ? (diff / r.prev) * 100 : 0;
          const hist = r.history.map((v) => fmt(v, big)).join(" → ");
          return (
            <div key={r.code} className="flex min-w-[180px] flex-1 items-center justify-between gap-3 border-l border-rule px-4 py-3" title={LABEL[r.code]}>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-ink-2">{r.code === "XAU" ? "Aur" : r.code}</div>
                <div className="mono text-[17px] font-medium leading-tight">{fmt(r.value, big)}</div>
                <div className="mono text-[11px] text-ink-3">
                  {diff === 0 ? "neschimbat" : `${diff > 0 ? "▲" : "▼"} ${pct > 0 ? "+" : ""}${pct.toFixed(2).replace(".", ",")}%`}
                </div>
              </div>
              <Spark values={r.history} label={`${LABEL[r.code] ?? r.code}, ultimele ${r.history.length} zile: ${hist} lei`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const change = (r: { value: number; prev?: number }) => {
  const diff = r.prev != null ? r.value - r.prev : 0;
  const pct = r.prev ? (diff / r.prev) * 100 : 0;
  return { diff, text: diff === 0 ? "=" : `${diff > 0 ? "▲" : "▼"} ${pct > 0 ? "+" : ""}${pct.toFixed(2).replace(".", ",")}%` };
};

/**
 * Banda de curs din bara de sus: toate valutele urmărite, cu variația zilei și tendința, într-o
 * bandă care se derulează continuu (se oprește la hover; statică dacă utilizatorul a cerut mișcare
 * redusă). Doar CSS, fără JavaScript.
 */
export function RatesTicker({ rates, codes = ["EUR", "USD", "GBP", "CHF", "MDL", "HUF", "XAU"] }: { rates: RatesData; codes?: string[] }) {
  const list = codes.map((c) => rates.rates.find((r) => r.code === c)).filter((r): r is NonNullable<typeof r> => Boolean(r));
  if (!list.length) return null;
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {list.map((r) => {
        const big = r.value > 100;
        const c = change(r);
        return (
          <li key={r.code} className="flex items-center gap-1.5 border-r border-rule px-3.5 whitespace-nowrap" title={LABEL[r.code]}>
            <span className="font-semibold text-ink-2">{r.code === "XAU" ? "Aur" : r.code}</span>
            <b className="mono font-medium text-ink">{fmt(r.value, big)}</b>
            <span className="mono text-[11px] text-ink-3">{c.text}</span>
            <Spark values={r.history} w={40} h={14} label={`${LABEL[r.code] ?? r.code}: ${r.history.map((v) => fmt(v, big)).join(" → ")} lei`} />
          </li>
        );
      })}
      <li className="whitespace-nowrap px-3.5 text-ink-3">Curs BNR</li>
    </ul>
  );
  return (
    <div className="marquee relative min-w-0 flex-1 overflow-hidden" aria-label="Cursul BNR">
      <div className="marquee-track flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
