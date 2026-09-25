import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeader({ title, href, color, kicker, children }: { title: string; href?: string; color?: string; kicker?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 border-t-[3px] pt-3" style={{ borderColor: color ?? "var(--ink)" }}>
      <div>
        {kicker && <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-widest text-ink-faint">{kicker}</div>}
        <h2 className="font-display text-2xl font-bold sm:text-[1.75rem]">{title}</h2>
      </div>
      {children}
      {href && (
        <Link href={href} className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink">
          Vezi tot <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
