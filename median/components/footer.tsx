import Link from "next/link";
import { CATEGORIES } from "@/lib/core/categories";

export function Footer({ outlets, ai = true }: { outlets: string[]; ai?: boolean }) {
  return (
    <footer className="mt-24 overflow-hidden bg-band text-on-band">
      <div className="mx-auto max-w-[1320px] px-4 pt-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="kicker opacity-60">Secțiuni</h3>
            <ul className="ui mt-3 space-y-1.5 text-[14px]">
              {CATEGORIES.slice(0, 6).map((c) => (
                <li key={c.slug}>
                  <Link href={`/categorie/${c.slug}`} className="hover:underline">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="kicker opacity-60">Mai mult</h3>
            <ul className="ui mt-3 space-y-1.5 text-[14px]">
              {CATEGORIES.slice(6).map((c) => (
                <li key={c.slug}>
                  <Link href={`/categorie/${c.slug}`} className="hover:underline">
                    {c.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/pe-scurt" className="hover:underline">
                  Pe scurt
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="kicker opacity-60">Redacția</h3>
            <ul className="ui mt-3 space-y-1.5 text-[14px]">
              <li><Link href="/despre" className="hover:underline">Despre Median</Link></li>
              <li><Link href="/politica-editoriala" className="hover:underline">Politica editorială</Link></li>
              <li><Link href="/politica-ai" className="hover:underline">Politica de utilizare a AI</Link></li>
              <li><Link href="/corecturi" className="hover:underline">Corecturi</Link></li>
              <li><Link href="/contact" className="hover:underline">Contact și drepturi de autor</Link></li>
              <li><a href="/rss.xml" className="hover:underline">Flux RSS</a></li>
            </ul>
          </div>
          <div>
            <h3 className="kicker opacity-60">Surse agregate</h3>
            <p className="ui mt-3 text-[13px] leading-relaxed opacity-80">{outlets.join(" · ")}</p>
            <Link href="/surse" className="ui mt-2 inline-block text-[13px] font-semibold underline underline-offset-4">
              Lista completă și starea fluxurilor
            </Link>
          </div>
        </div>
        <p className="ui mt-12 max-w-3xl text-[12px] leading-relaxed opacity-60">
          {ai
            ? "Median sintetizează automat, cu ajutorul inteligenței artificiale, știri publicate de alte redacții. Faptele aparțin surselor citate, care sunt indicate la fiecare articol; formularea este a Median. Semnalează o eroare la pagina Corecturi."
            : "Median grupează automat știrile publicate de alte redacții: titlul, un extras scurt și legătura către fiecare sursă. Textul complet aparține publicațiilor citate. Semnalează o eroare la pagina Corecturi."}
        </p>
      </div>
      <div aria-hidden className="masthead -mb-[3.2vw] mt-10 select-none whitespace-nowrap text-center text-[21vw] leading-[0.8] opacity-95">
        Median<span className="inline-block h-[0.18em] w-[0.18em] bg-accent" />
      </div>
    </footer>
  );
}
