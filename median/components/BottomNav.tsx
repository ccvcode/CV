"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, House, LayoutGrid, Radio, Search } from "lucide-react";
import { cx } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Acasă", icon: House },
  { href: "/categorii", label: "Categorii", icon: LayoutGrid },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/salvate", label: "Salvate", icon: Bookmark },
  { href: "/cauta", label: "Caută", icon: Search },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[env(safe-area-inset-bottom)] sm:hidden" aria-label="Navigare principală">
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} className={cx("flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium", active ? "text-brand" : "text-ink-muted")}>
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
