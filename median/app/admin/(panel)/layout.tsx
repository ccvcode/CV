import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Redacție", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const nav = [
    ["/admin", "Stare"],
    ["/admin/aprobare", "De aprobat"],
    ["/admin/subiecte", "Subiecte"],
    ["/admin/surse", "Surse"],
    ["/admin/semnalari", "Semnalări"],
  ];
  return (
    <main className="ui mx-auto max-w-[1320px] px-4 pb-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-rule-strong pb-3 pt-8">
        <h1 className="section-head text-[40px]">Redacție</h1>
        <nav className="flex flex-wrap gap-5 text-[14px] font-semibold">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="text-ink-2 hover:text-ink">
              {label}
            </Link>
          ))}
          <form action={logout}>
            <button className="text-ink-3 hover:text-ink">Ieșire</button>
          </form>
        </nav>
      </div>
      <div className="mt-6">{children}</div>
    </main>
  );
}
