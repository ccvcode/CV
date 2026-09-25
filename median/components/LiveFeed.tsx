"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/categories";
import type { Article, CategorySlug } from "@/lib/types";
import { articleHref, cx, formatTime } from "@/lib/utils";
import { ArticleImage } from "./ArticleImage";
import { Favicon } from "./Favicon";

type Item = Pick<Article, "id" | "slug" | "title" | "sourceName" | "sourceSite" | "category" | "published" | "image">;

const DAY = new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Bucharest" });
const HOUR = new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", timeZone: "Europe/Bucharest", hourCycle: "h23" });

export function LiveFeed({ items }: { items: Item[] }) {
  const [filter, setFilter] = useState<CategorySlug | "all">("all");
  const list = useMemo(() => (filter === "all" ? items : items.filter((i) => i.category === filter)), [items, filter]);

  // Grupăm pe zi și oră pentru o cronologie ușor de parcurs.
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: Item[] }[] = [];
    for (const it of list) {
      const d = DAY.format(it.published);
      const key = d + HOUR.format(it.published);
      let g = out[out.length - 1];
      if (!g || g.key !== key) out.push((g = { key, label: `${d}, ora ${HOUR.format(it.published)}:00`, items: [] }));
      g.items.push(it);
    }
    return out;
  }, [list]);

  return (
    <>
      <div className="no-scrollbar sticky top-[112px] z-30 -mx-4 mt-6 flex gap-2 overflow-x-auto bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          Toate <span className="opacity-60">{items.length}</span>
        </Chip>
        {CATEGORIES.map((c) => {
          const n = items.filter((i) => i.category === c.slug).length;
          if (!n) return null;
          return (
            <Chip key={c.slug} active={filter === c.slug} color={c.color} onClick={() => setFilter(c.slug)}>
              {c.short} <span className="opacity-60">{n}</span>
            </Chip>
          );
        })}
      </div>
      <div className="mt-4">
        {groups.map((g) => (
          <section key={g.key} className="mb-6">
            <h2 className="sticky top-[168px] z-20 mb-2 inline-block rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold capitalize text-ink-muted">{g.label}</h2>
            <ol>
              {g.items.map((a) => {
                const c = CATEGORY_MAP[a.category];
                return (
                  <li key={a.id} className="group relative grid grid-cols-[48px_1fr_auto] items-start gap-3 border-b border-line py-3.5 last:border-0">
                    <span className="pt-0.5 text-sm font-semibold tabular-nums text-ink-muted">{formatTime(a.published)}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: c?.color }}>
                        {c?.short}
                      </div>
                      <Link href={articleHref(a)} className="mt-0.5 block font-semibold leading-snug after:absolute after:inset-0">
                        <span className="link-underline">{a.title}</span>
                      </Link>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                        <Favicon name={a.sourceName} site={a.sourceSite} size={14} /> {a.sourceName}
                      </div>
                    </div>
                    {a.image ? <ArticleImage src={a.image} alt="" category={a.category} className="h-16 w-20 rounded-lg" /> : <span />}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
        {!groups.length && <p className="py-16 text-center text-ink-muted">Nicio știre în această categorie deocamdată.</p>}
      </div>
    </>
  );
}

function Chip({ active, color, onClick, children }: { active: boolean; color?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition", active ? "border-transparent bg-ink text-bg" : "border-line bg-surface text-ink-muted hover:text-ink")}
      style={active && color ? { background: color, color: "white" } : undefined}
    >
      {children}
    </button>
  );
}
