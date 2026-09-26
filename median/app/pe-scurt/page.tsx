import type { Metadata } from "next";
import Link from "next/link";
import { LiveUpdater } from "@/components/live-updater";
import { Kicker, sourcesLabel } from "@/components/story";
import { Clock } from "@/components/time";
import { latestStories } from "@/lib/data/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pe scurt — toate știrile, minut cu minut", description: "Fluxul complet al știrilor Median, în ordine cronologică, actualizat la fiecare 5 minute." };

const DAY = new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Bucharest" });

export default async function Live({ searchParams }: { searchParams: Promise<{ inainte?: string }> }) {
  const before = Number((await searchParams).inainte) || undefined;
  const list = latestStories({ limit: 80, before });
  const groups: { day: string; items: typeof list }[] = [];
  for (const s of list) {
    const d = DAY.format(s.published);
    if (groups[groups.length - 1]?.day !== d) groups.push({ day: d, items: [] });
    groups[groups.length - 1].items.push(s);
  }
  const last = list[list.length - 1];
  return (
    <main className="mx-auto max-w-[1320px] px-4 sm:px-8">
      <LiveUpdater since={Date.now()} />
      <header className="pt-10">
        <div className="kicker flex items-center gap-2 text-accent">
          <span className="inline-block h-2 w-2 bg-accent" /> Actualizat la 5 minute
        </div>
        <h1 className="section-head mt-2 text-[48px] sm:text-[88px]">Pe scurt</h1>
        <p className="dek mt-3 max-w-2xl border-b-2 border-rule-strong pb-4 text-[19px]">Toate știrile, în ordinea în care apar. Fiecare trimite la articolul complet și la sursele lui.</p>
      </header>
      <div className="grid lg:grid-cols-12">
        <div className="lg:col-span-8">
          {groups.map((g) => (
            <section key={g.day} className="mt-8">
              <h2 className="kicker sticky top-[52px] z-10 border-b border-rule bg-paper py-2 capitalize text-ink-2">{g.day}</h2>
              <ol>
                {g.items.map((s) => (
                  <li key={s.id} className="group relative grid grid-cols-[64px_1fr] gap-4 border-b border-rule py-4">
                    <Clock ts={s.published} className="mono pt-0.5 text-[13px] text-ink-3" />
                    <div>
                      <Kicker story={s} className="mb-1" />
                      <h3 className="hl hl-md">
                        <Link href={s.href} className="stretched">
                          {s.title}
                        </Link>
                      </h3>
                      {s.dek && <p className="mt-1.5 text-[16px] leading-snug text-ink-2">{s.dek}</p>}
                      <div className="meta mt-1.5">{sourcesLabel(s)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {last && list.length >= 80 && (
            <Link href={`/pe-scurt?inainte=${last.published}`} className="ui mt-8 inline-block text-[14px] font-semibold underline underline-offset-4">
              Mai vechi →
            </Link>
          )}
          {!list.length && <p className="dek py-16 text-[20px]">Nicio știre deocamdată.</p>}
        </div>
      </div>
    </main>
  );
}
