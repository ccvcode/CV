import type { Metadata } from "next";
import { CATEGORY_MAP } from "@/lib/core/categories";
import type { CategorySlug } from "@/lib/core/types";
import { formatDate } from "@/lib/core/utils";
import { feedProblem, outletsList, siteStatus } from "@/lib/data/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sursele noastre", description: "Publicațiile și fluxurile RSS urmărite de Median, cu starea lor în timp real." };

export default function Sources() {
  const outlets = outletsList();
  const st = siteStatus();
  const down = outlets.filter((o) => o.ok < o.feeds);
  const total24 = outlets.reduce((n, o) => n + o.day, 0);
  return (
    <main className="mx-auto max-w-[1320px] px-4 sm:px-8">
      <header className="pt-10">
        <div className="kicker text-ink-3">Transparență</div>
        <h1 className="section-head mt-1 text-[44px] sm:text-[72px]">Sursele noastre</h1>
        <p className="dek mt-3 max-w-3xl text-[20px]">
          Median urmărește {st.outlets} publicații prin {st.sourcesTotal} fluxuri RSS publice. La fiecare 5 minute verifică fluxurile și grupează
          articolele despre același subiect{st.ai ? ", apoi redactează o sinteză cu trimitere la fiecare sursă" : ", cu trimitere la fiecare sursă"}.
        </p>
        <p className="ui mt-4 text-[14px] text-ink-2">
          <b className="font-semibold text-ink">{st.sourcesOk}</b> din {st.sourcesTotal} fluxuri răspund acum
          {down.length > 0 && <> · {down.length} publicații cu probleme temporare</>} ·{" "}
          <b className="font-semibold text-ink">{total24}</b> articole preluate în ultimele 24 de ore
        </p>
        <div className="mt-4 h-[2px] bg-rule-strong" />
      </header>
      <table className="ui mt-6 w-full text-[14px]">
        <thead>
          <tr className="kicker border-b border-rule text-left text-ink-3">
            <th className="py-2 font-bold">Publicație</th>
            <th className="hidden py-2 font-bold sm:table-cell">Secțiuni</th>
            <th className="py-2 text-right font-bold">Fluxuri</th>
            <th className="py-2 text-right font-bold">
              <span className="hidden sm:inline">Articole </span>24h
            </th>
            <th className="hidden py-2 text-right font-bold md:table-cell">Ultima verificare</th>
          </tr>
        </thead>
        <tbody>
          {outlets.map((o) => (
            <tr key={o.name} className="border-b border-rule">
              <td className="py-2.5 align-top">
                <a href={o.site} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
                  {o.name}
                </a>
                {o.ok < o.feeds && (
                  <span className="block text-[12px] text-accent-ink">
                    {o.ok === 0 ? "" : `${o.feeds - o.ok} din ${o.feeds} fluxuri: `}
                    {feedProblem(o.errors)}
                  </span>
                )}
              </td>
              <td className="hidden py-2.5 text-ink-2 sm:table-cell">
                {[...new Set(o.categories.split(","))].map((c) => CATEGORY_MAP[c as CategorySlug]?.short ?? c).join(", ")}
              </td>
              <td className="mono py-2.5 text-right">
                <span className={o.ok < o.feeds ? "text-accent-ink" : ""}>
                  {o.ok}/{o.feeds}
                </span>
              </td>
              <td className="mono py-2.5 text-right">{o.day}</td>
              <td className="mono hidden py-2.5 text-right text-ink-3 md:table-cell" suppressHydrationWarning>
                {o.last_fetch ? formatDate(o.last_fetch) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="meta mt-6 max-w-3xl">
        Respectăm fișierele robots.txt și rezervările de exploatare a textelor (TDM) ale fiecărui site. Agenția Agerpres nu este preluată, fiind un
        serviciu cu abonament. Publicațiile care nu doresc să fie incluse ne pot scrie la pagina Contact.
      </p>
    </main>
  );
}
