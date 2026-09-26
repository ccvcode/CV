import type { Metadata } from "next";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { Figure } from "@/components/figure";
import { Kicker, listImage } from "@/components/story";
import { weatherLabel } from "@/components/weather";
import { config } from "@/lib/core/config";
import { activeAlerts, LEVEL_NAME } from "@/lib/data/alerts";
import { briefStories, briefText } from "@/lib/data/queries";
import { getRates, getWeather } from "@/lib/data/widgets";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ce trebuie să știi azi",
  description: "Cele mai importante 7 subiecte ale zilei, alese după câte redacții le-au relatat. Se citește în trei minute.",
};

export default async function Today() {
  const stories = briefStories(7);
  const [rates, weather, alerts] = await Promise.all([
    getRates().catch(() => null),
    getWeather().catch(() => null),
    activeAlerts().catch(() => ({ weather: [], quakes: [] })),
  ]);
  const day = new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Bucharest" }).format(Date.now());
  const buc = weather?.[0];
  const eur = rates?.rates.find((r) => r.code === "EUR");
  const text = briefText(stories);
  const btn = "ui inline-flex items-center border border-rule-strong px-3 py-1.5 text-[14px] font-semibold hover:bg-ink hover:text-on-ink";
  return (
    <main className="mx-auto max-w-[760px] px-4 sm:px-8">
      <header className="pt-10">
        <div className="kicker text-accent first-letter:uppercase">{day}</div>
        <h1 className="section-head mt-1 text-[44px] leading-[0.95] sm:text-[64px]">Ce trebuie să știi azi</h1>
        <p className="dek mt-3 text-[19px]">
          {stories.length} subiecte, alese după câte redacții le-au relatat în ultimele 24 de ore. Trei minute de citit.
        </p>
        <div className="ui mt-4 flex flex-wrap gap-x-5 gap-y-1 border-y border-rule py-2 text-[13px] text-ink-2">
          {buc && (
            <span>
              București <b className="mono text-ink">{buc.temp}°</b>, {weatherLabel(buc.code)}, max. {buc.daily[0]?.max}°
            </span>
          )}
          {eur && (
            <span>
              Euro <b className="mono text-ink">{eur.value.toFixed(4).replace(".", ",")}</b> lei
            </span>
          )}
          {alerts.weather[0] ? (
            <Link href="/alerte" className="flex items-center gap-1.5 font-semibold text-ink hover:underline">
              <span className={`lvl lvl-${alerts.weather[0].level}`} aria-hidden /> Cod {LEVEL_NAME[alerts.weather[0].level]} ANM
            </Link>
          ) : (
            <span>Fără avertizări meteo</span>
          )}
        </div>
      </header>

      <ol className="mt-4">
        {stories.map((s, i) => {
          const img = listImage(s);
          return (
            <li key={s.id} className="group relative grid grid-cols-[36px_1fr] gap-x-3 border-b border-rule py-6 sm:grid-cols-[48px_1fr_140px] sm:gap-x-5">
              <span className="section-head text-[36px] leading-none text-accent sm:text-[44px]">{i + 1}</span>
              <div className="min-w-0">
                <Kicker story={s} className="mb-1" />
                <h2 className="hl text-[22px] leading-tight sm:text-[25px]">
                  <Link href={s.href} className="stretched">
                    {s.title}
                  </Link>
                </h2>
                {s.dek && <p className="dek mt-2 text-[16px]">{s.dek}</p>}
                <div className="meta mt-2">{s.sourceCount} publicații au relatat</div>
              </div>
              {img && <Figure img={img} ratio="1/1" sizes="140px" className="hidden sm:block" />}
            </li>
          );
        })}
      </ol>

      <section className="mt-10 border-t-2 border-rule-strong pt-6 text-center">
        <p className="section-head text-[30px]">Ai terminat.</p>
        <p className="dek mx-auto mt-2 max-w-md text-[17px]">Asta a contat azi. Restul știrilor sunt pe prima pagină, în ordinea importanței.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/notificari" className={btn}>
            Primește-l zilnic la 7:00
          </Link>
          {config.telegramUrl && (
            <a href={config.telegramUrl} target="_blank" rel="noopener noreferrer" className={btn}>
              Canalul de Telegram
            </a>
          )}
          <CopyButton text={text} label="Copiază pentru WhatsApp" className={btn} />
          <Link href="/" className={btn}>
            Prima pagină
          </Link>
        </div>
      </section>
    </main>
  );
}
