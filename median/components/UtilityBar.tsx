import Link from "next/link";
import { CloudSun } from "lucide-react";
import type { CityWeather, RatesData } from "@/lib/widgets";
import { TimeAgo, Today } from "./TimeAgo";

export function UtilityBar({ rates, weather, updatedAt, sourcesOk }: { rates: RatesData | null; weather: CityWeather[] | null; updatedAt: number; sourcesOk: number }) {
  const eur = rates?.rates.find((r) => r.code === "EUR");
  const usd = rates?.rates.find((r) => r.code === "USD");
  const buc = weather?.[0];
  return (
    <div className="mx-auto flex max-w-7xl items-center gap-4 overflow-hidden px-4 py-1.5 text-xs text-ink-muted sm:px-6">
      <Today className="shrink-0 font-medium capitalize text-ink" />
      {buc && (
        <span className="hidden shrink-0 items-center gap-1 sm:inline-flex">
          <CloudSun className="h-3.5 w-3.5" /> București {buc.temp}°
        </span>
      )}
      {eur && (
        <Link href="/#curs" className="hidden shrink-0 tabular-nums hover:text-ink md:inline">
          EUR <b className="font-semibold text-ink">{eur.value.toFixed(4)}</b>
        </Link>
      )}
      {usd && (
        <Link href="/#curs" className="hidden shrink-0 tabular-nums hover:text-ink md:inline">
          USD <b className="font-semibold text-ink">{usd.value.toFixed(4)}</b>
        </Link>
      )}
      <span className="ml-auto inline-flex shrink-0 items-center gap-1.5">
        <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-live text-live" />
        <span className="hidden sm:inline">Actualizat</span> <TimeAgo ts={updatedAt} />
        <span className="hidden lg:inline">· {sourcesOk === 1 ? "o sursă activă" : `${sourcesOk} surse active`}</span>
      </span>
    </div>
  );
}
