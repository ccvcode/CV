import Link from "next/link";
import { CATEGORIES } from "@/lib/core/categories";
import { config } from "@/lib/core/config";

const COLS: { title: string; links: [string, string][] }[] = [
  {
    title: "Median",
    links: [
      ["/despre", "Despre noi"],
      ["/surse", "Sursele noastre"],
      ["/politica-editoriala", "Politica editorială"],
      ["/politica-ai", "Utilizarea AI"],
      ["/corecturi", "Corecturi"],
    ],
  },
  {
    title: "Informații legale",
    links: [
      ["/termeni", "Termeni de utilizare"],
      ["/confidentialitate", "Confidențialitate (GDPR)"],
      ["/cookies", "Cookie-uri"],
      ["/contact", "Drepturi de autor"],
    ],
  },
  {
    title: "Urmărește",
    links: [
      ["/pe-scurt", "Toate știrile, pe scurt"],
      ["/salvate", "Articole salvate"],
      ["/rss.xml", "Flux RSS"],
      ["/contact", "Contact"],
    ],
  },
];

export function Footer({ ai = true }: { ai?: boolean }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 overflow-hidden bg-band text-on-band">
      <div className="mx-auto max-w-[1320px] px-4 pt-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <h3 className="kicker opacity-60">Secțiuni</h3>
            <ul className="ui mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[14px]">
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link href={`/categorie/${c.slug}`} className="hover:underline">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {COLS.map((col) => (
            <div key={col.title}>
              <h3 className="kicker opacity-60">{col.title}</h3>
              <ul className="ui mt-3 space-y-1.5 text-[14px]">
                {col.links.map(([href, label]) => (
                  <li key={label}>
                    {href.endsWith(".xml") ? (
                      <a href={href} className="hover:underline">
                        {label}
                      </a>
                    ) : (
                      <Link href={href} className="hover:underline">
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="ui mt-12 flex flex-col gap-3 border-t border-band-rule pt-5 text-[12px] leading-relaxed opacity-70 md:flex-row md:justify-between">
          <p className="max-w-3xl">
            {ai
              ? "Median sintetizează automat, cu ajutorul inteligenței artificiale, știri publicate de alte redacții. Faptele aparțin surselor citate, indicate la fiecare articol."
              : "Median grupează automat știrile publicate de alte redacții: titlul, un extras scurt și legătura către fiecare sursă. Textul complet aparține publicațiilor citate."}
          </p>
          <p className="shrink-0">
            © {year} {config.company || "Median"} · <a href={`mailto:${config.contactEmail}`} className="hover:underline">{config.contactEmail}</a>
          </p>
        </div>
      </div>
      <div aria-hidden className="masthead -mb-[3.2vw] mt-10 select-none whitespace-nowrap text-center text-[21vw] leading-[0.8] opacity-95">
        Median<span className="inline-block h-[0.18em] w-[0.18em] bg-accent" />
      </div>
    </footer>
  );
}
