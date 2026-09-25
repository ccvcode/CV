import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { Logo } from "./Logo";

export function Footer({ sourcesTotal }: { sourcesTotal: number }) {
  return (
    <footer className="mt-20 border-t border-line bg-surface pb-24 sm:pb-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo size="lg" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-muted">
            Toate sursele. Un singur loc. Median adună automat, la fiecare 5 minute, știrile din {sourcesTotal}+ fluxuri ale publicațiilor
            românești și le grupează pe subiecte, ca să vezi rapid cine ce relatează.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-faint">Știri</h4>
          <ul className="space-y-2 text-sm">
            {CATEGORIES.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link href={`/categorie/${c.slug}`} className="hover:text-brand">
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-faint">Mai mult</h4>
          <ul className="space-y-2 text-sm">
            {CATEGORIES.slice(6).map((c) => (
              <li key={c.slug}>
                <Link href={`/categorie/${c.slug}`} className="hover:text-brand">
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-faint">Median</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/live" className="hover:text-brand">Pe scurt (live)</Link></li>
            <li><Link href="/surse" className="hover:text-brand">Sursele noastre</Link></li>
            <li><Link href="/salvate" className="hover:text-brand">Articole salvate</Link></li>
            <li><Link href="/despre" className="hover:text-brand">Despre Median</Link></li>
            <li><a href="/feed.xml" className="hover:text-brand">Flux RSS</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} Median. Conținutul aparține publicațiilor citate; Median afișează titlul, un scurt extras și link către sursă.</span>
          <span>Făcut cu grijă în România 🇷🇴</span>
        </div>
      </div>
    </footer>
  );
}
