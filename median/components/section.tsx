import Link from "next/link";
import { cx } from "@/lib/core/utils";

export function SectionHead({ title, href, links, className, size = "lg" }: { title: string; href?: string; links?: { href: string; label: string }[]; className?: string; size?: "lg" | "md" }) {
  return (
    <div className={cx("mb-5 border-t-2 border-rule-strong pt-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 className={cx("section-head", size === "lg" ? "text-[30px] sm:text-[44px]" : "text-[24px] sm:text-[30px]")}>
          {href ? (
            <Link href={href} className="hover:text-accent-ink">
              {title}
            </Link>
          ) : (
            title
          )}
        </h2>
        {links && links.length > 0 && (
          <nav className="ui no-scrollbar flex max-w-full gap-x-4 overflow-x-auto whitespace-nowrap pb-1 text-[13px] font-semibold text-ink-2">
            {links.map((l, i) => (
              <Link key={l.href} href={l.href} className="hover:text-ink">
                {i > 0 && <span aria-hidden className="mr-4 text-ink-3">·</span>}
                {l.label}
              </Link>
            ))}
          </nav>
        )}
        {href && !links && (
          <Link href={href} className="ui pb-1 text-[13px] font-semibold text-ink-2 hover:text-ink">
            Toate →
          </Link>
        )}
      </div>
    </div>
  );
}
