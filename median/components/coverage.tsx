import Link from "next/link";
import { CATEGORY_MAP } from "@/lib/core/categories";
import type { CategorySlug } from "@/lib/core/types";
import { type Coverage, GROUPS, type GroupKey } from "@/lib/data/coverage";

const NONE: Record<GroupKey, string> = {
  tv: "Nicio televiziune sau radio",
  presa: "Niciun ziar sau revistă",
  online: "Nicio publicație online",
  agentie: "Nicio agenție de presă",
  international: "Nicio redacție internațională",
  moldova: "Nicio publicație din R. Moldova",
};

export function blindLabel(g: GroupKey[]): string {
  return g.map((x) => NONE[x]).join(" · ");
}

/**
 * „Cine a relatat”: publicațiile care au scris despre subiect și cele care, deși acoperă de obicei
 * tema, nu au scris (încă). Grupate după tipul redacției.
 */
export function CoverageMap({ coverage, category, links }: { coverage: Coverage; category: CategorySlug; links: Map<string, string> }) {
  const cat = CATEGORY_MAP[category]?.label.toLowerCase() ?? "";
  return (
    <section className="mt-12 border-t-2 border-rule-strong pt-3" id="acoperire">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="kicker text-ink-2">Cine a relatat · unghi mort</h2>
        <Link href="/unghi-mort" className="ui text-[12px] text-ink-3 underline-offset-4 hover:text-ink hover:underline">
          Ce este?
        </Link>
      </div>
      <p className="ui mt-2 text-[15px]">
        Au relatat <b>{coverage.coveredCount}</b> din {coverage.relevantCount} publicații active care scriu de obicei despre {cat}.
      </p>
      {coverage.blind.length > 0 && (
        <p className="ui mt-2 border-l-[3px] border-accent pl-3 text-[15px] font-semibold">{blindLabel(coverage.blind)} nu a relatat subiectul.</p>
      )}
      <dl className="ui mt-4 space-y-3 text-[13px]">
        {coverage.groups.map((g) => (
          <div key={g.key} className="grid gap-1 sm:grid-cols-[210px_1fr]">
            <dt className="text-ink-3">
              {g.label} <span className="mono">({g.covered.length}/{g.covered.length + g.silent.length})</span>
            </dt>
            <dd className="flex flex-wrap gap-1.5">
              {g.covered.map((o) => {
                const href = links.get(o.name);
                const chip = "inline-flex items-center gap-1 border border-ink px-2 py-0.5 font-semibold";
                return href ? (
                  <a key={o.name} href={href} target="_blank" rel="noopener noreferrer" className={chip + " hover:bg-ink hover:text-on-ink"}>
                    <span aria-hidden>✓</span> {o.name}
                  </a>
                ) : (
                  <span key={o.name} className={chip}>
                    <span aria-hidden>✓</span> {o.name}
                  </span>
                );
              })}
              {g.silent.map((o) => (
                <span key={o.name} className="inline-flex items-center border border-dashed border-rule px-2 py-0.5 text-ink-3" title="Nu a relatat (încă)">
                  <span className="sr-only">Nu a relatat: </span>
                  {o.name}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <p className="meta mt-3 text-[11px]">
        Comparăm doar cu publicațiile ale căror fluxuri funcționează și care au publicat în ultimele 24 de ore. Tăcerea poate însemna și că
        publicația a relatat sub alt titlu sau doar pe site, fără flux RSS.
      </p>
    </section>
  );
}

export const GROUP_LABELS = GROUPS;
