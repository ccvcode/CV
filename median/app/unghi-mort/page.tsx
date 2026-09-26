import type { Metadata } from "next";
import { blindLabel } from "@/components/coverage";
import { StoryRow } from "@/components/story";
import { GROUPS, type GroupKey } from "@/lib/data/coverage";
import { blindspotStories } from "@/lib/data/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Unghi mort: știrile pe care unele redacții nu le-au relatat",
  description: "Subiectele relatate de multe publicații, dar ignorate de un întreg tip de redacții: televiziuni, ziare, publicații online sau agenții.",
};

export default function Blindspot() {
  const list = blindspotStories(30);
  const byGroup = new Map<GroupKey, typeof list>();
  for (const b of list) for (const g of b.blind) byGroup.set(g, [...(byGroup.get(g) ?? []), b]);
  return (
    <main className="mx-auto max-w-[1320px] px-4 sm:px-8">
      <header className="pt-10">
        <div className="kicker text-ink-3">Acoperire</div>
        <h1 className="section-head mt-1 text-[44px] sm:text-[72px]">Unghi mort</h1>
        <p className="dek mt-3 max-w-3xl text-[20px]">
          Subiecte din ultimele 48 de ore relatate de cel puțin patru publicații, pe care un întreg tip de redacții nu le-a relatat. Ce nu vezi
          la televizor, dar citești online, și invers.
        </p>
        <div className="mt-4 h-[2px] bg-rule-strong" />
      </header>

      {list.length === 0 && <p className="ui mt-8 text-[16px] text-ink-2">Acum nu există subiecte importante ignorate de un întreg tip de redacții.</p>}

      <div className="mt-8 grid gap-12 lg:grid-cols-2">
        {[...byGroup.entries()].map(([g, items]) => (
          <section key={g}>
            <h2 className="section-head border-b-2 border-rule-strong pb-2 text-[24px]">Ignorate de: {GROUPS[g].toLowerCase()}</h2>
            <ul>
              {items.slice(0, 8).map(({ story, coverage }) => (
                <li key={story.id} className="border-b border-rule py-4">
                  <StoryRow story={story} thumb />
                  <p className="ui mt-2 text-[12px] text-ink-2">
                    Au relatat:{" "}
                    {coverage.groups
                      .filter((x) => x.covered.length)
                      .map((x) => `${x.label.toLowerCase()} (${x.covered.length})`)
                      .join(", ")}
                    . <b className="text-accent-ink">{blindLabel([g])}.</b>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="prose-median mt-16 max-w-[680px] border-t border-rule pt-6">
        <h2>Cum se calculează</h2>
        <ul className="list-disc pl-5">
          <li>Grupăm publicațiile după tipul redacției: televiziuni și radio, ziare și reviste, publicații online, agenții de presă. Nu le etichetăm politic.</li>
          <li>
            Pentru fiecare subiect comparăm doar cu publicațiile care scriu de obicei despre tema lui, ale căror fluxuri funcționează și care au
            publicat în ultimele 24 de ore.
          </li>
          <li>Un grup intră în „unghi mort” dacă are cel puțin trei astfel de publicații și niciuna nu a relatat, deși subiectul are cel puțin trei ore și patru relatări.</li>
          <li>Tăcerea poate avea și explicații banale: un titlu foarte diferit, un articol publicat doar pe site, fără flux RSS. Verifică sursele.</li>
        </ul>
      </section>
    </main>
  );
}
