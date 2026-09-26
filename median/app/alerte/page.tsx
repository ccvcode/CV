import type { Metadata } from "next";
import Link from "next/link";
import { QuakeTable, WeatherAlertCard } from "@/components/alerts";
import { getQuakes, getWeatherAlerts } from "@/lib/data/alerts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Alerte meteo și cutremure",
  description: "Avertizările ANM în vigoare (cod galben, portocaliu, roșu) și cutremurele recente din România.",
};

export default async function Alerts() {
  const [weather, quakes] = await Promise.all([getWeatherAlerts().catch(() => []), getQuakes({ days: 7, minMag: 2.5 }).catch(() => [])]);
  return (
    <main className="mx-auto max-w-[1320px] px-4 sm:px-8">
      <header className="pt-10">
        <div className="kicker text-ink-3">Informații oficiale</div>
        <h1 className="section-head mt-1 text-[44px] sm:text-[72px]">Alerte</h1>
        <p className="dek mt-3 max-w-3xl text-[20px]">
          Avertizările meteorologice ale ANM și cutremurele din zona României, actualizate la câteva minute.{" "}
          <Link href="/notificari" className="underline underline-offset-4">
            Primește o notificare
          </Link>{" "}
          la cod roșu, cod portocaliu sau la un cutremur de peste 4.
        </p>
        <div className="mt-4 h-[2px] bg-rule-strong" />
      </header>

      <section className="mt-8">
        <h2 className="section-head text-[28px]">Vremea: avertizări ANM</h2>
        {weather.length ? (
          weather.map((a) => <WeatherAlertCard key={a.id} a={a} />)
        ) : (
          <p className="ui mt-3 border-t border-rule pt-4 text-[15px] text-ink-2">Nu există avertizări meteorologice în vigoare.</p>
        )}
        <p className="meta mt-4">
          Sursa:{" "}
          <a href="https://www.meteoromania.ro/avertizari/" target="_blank" rel="noopener noreferrer" className="underline">
            Administrația Națională de Meteorologie
          </a>
          .
        </p>
      </section>

      <section className="mt-14">
        <h2 className="section-head text-[28px]">Cutremure, ultimele 7 zile</h2>
        {quakes.length ? <QuakeTable quakes={quakes} /> : <p className="ui mt-3 text-[15px] text-ink-2">Niciun cutremur de peste 2,5 în ultimele 7 zile.</p>}
        <p className="meta mt-4">
          Sursa: EMSC, cu datele Institutului Național pentru Fizica Pământului (INFP). Magnitudinile pot fi revizuite.
        </p>
      </section>
    </main>
  );
}
