import type { Metadata } from "next";
import Link from "next/link";
import { ReportForm } from "@/components/report-form";
import { formatDate } from "@/lib/core/utils";
import { db } from "@/lib/core/db";
import { storyHref } from "@/lib/data/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Corecturi" };

export default async function Corrections({ searchParams }: { searchParams: Promise<{ stire?: string }> }) {
  const storyId = (await searchParams).stire;
  const rows = db()
    .prepare("SELECT c.text, c.created_at, s.id, s.slug, s.title FROM corrections c JOIN stories s ON s.id = c.story_id ORDER BY c.created_at DESC LIMIT 100")
    .all() as { text: string; created_at: number; id: string; slug: string; title: string }[];
  return (
    <main className="mx-auto max-w-[1320px] px-4 sm:px-8">
      <header className="pt-10">
        <div className="kicker text-ink-3">Transparență</div>
        <h1 className="section-head mt-1 text-[44px] sm:text-[72px]">Corecturi</h1>
        <p className="dek mt-3 max-w-3xl text-[20px]">Toate corecturile publicate, în ordine. Orice semnalare întemeiată primește un răspuns în 48 de ore.</p>
        <div className="mt-4 h-[2px] bg-rule-strong" />
      </header>
      <div className="mt-8 grid gap-12 lg:grid-cols-12">
        <section className="lg:col-span-7">
          {rows.length ? (
            <ul>
              {rows.map((r, i) => (
                <li key={i} className="border-b border-rule py-4">
                  <div className="meta" suppressHydrationWarning>{formatDate(r.created_at)}</div>
                  <Link href={storyHref(r)} className="hl hl-sm hl-link mt-1 block">
                    {r.title}
                  </Link>
                  <p className="mt-1 text-[16px] text-ink-2">{r.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dek text-[18px]">Nicio corectură publicată până acum.</p>
          )}
        </section>
        <aside className="lg:col-span-5">
          <h2 className="kicker text-ink-2">Semnalează o eroare</h2>
          <ReportForm kind="corectura" storyId={storyId} />
        </aside>
      </div>
    </main>
  );
}
