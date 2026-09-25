import type { Metadata } from "next";
import { Favicon } from "@/components/Favicon";
import { TimeAgo } from "@/components/TimeAgo";
import { CATEGORY_MAP } from "@/lib/categories";
import { OUTLETS } from "@/lib/sources";
import { getSourceStatus, getState } from "@/lib/store";

// Știrile stau în memoria serverului, deci randarea e rapidă: servim mereu varianta la zi.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sursele noastre", description: "Lista completă a publicațiilor și fluxurilor RSS agregate de Median." };

const KIND: Record<string, string> = { tv: "Televiziune", online: "Publicație online", agentie: "Agenție de presă", presa: "Presă scrisă", international: "Serviciu internațional" };

export default async function Sources() {
  const state = await getState();
  const status = getSourceStatus();
  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6">
      <h1 className="font-display text-4xl font-black sm:text-5xl">Sursele noastre</h1>
      <p className="mt-3 max-w-2xl text-ink-muted">
        Median preia automat, la fiecare 5 minute, titlurile și rezumatele din fluxurile RSS publice ale acestor publicații. Fiecare articol trimite către
        sursa originală. Acum sunt active <b className="text-ink">{state.sourcesOk}</b> din {state.sourcesTotal} fluxuri
        {state.updatedAt ? <> · ultima colectare <TimeAgo ts={state.updatedAt} /></> : null}.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {OUTLETS.map((o) => {
          const count = state.articles.filter((a) => a.sourceName === o.name).length;
          const okFeeds = o.feeds.filter((f) => status[f.id]?.ok).length;
          return (
            <div key={o.name} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center gap-3">
                <Favicon name={o.name} site={o.site} size={36} />
                <div className="min-w-0">
                  <a href={o.site} target="_blank" rel="noopener noreferrer" className="block truncate font-semibold hover:text-brand">
                    {o.name}
                  </a>
                  <div className="text-xs text-ink-muted">{KIND[o.kind ?? "online"]}</div>
                </div>
                <span
                  className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: okFeeds ? "var(--live)" : Object.keys(status).length ? "var(--breaking)" : "var(--ink-faint)" }}
                  title={okFeeds ? "Activ" : "Indisponibil momentan"}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {o.feeds.map((f) => (
                  <span key={f.id} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: CATEGORY_MAP[f.category].color, background: `color-mix(in oklab, ${CATEGORY_MAP[f.category].color} 12%, transparent)` }}>
                    {CATEGORY_MAP[f.category].short}
                  </span>
                ))}
              </div>
              <div className="mt-3 text-xs text-ink-faint">{count} articole în ultimele zile</div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
