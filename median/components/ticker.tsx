"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatTime } from "@/lib/core/utils";

type Item = { href: string; title: string; ts: number };

function Label() {
  return (
    <Link href="/pe-scurt" className="kicker flex shrink-0 items-center gap-2 text-accent hover:underline">
      <span aria-hidden className="live-dot" />
      Ultima oră
    </Link>
  );
}

/**
 * „Ultima oră”: pe desktop, cele mai noi trei subiecte importante, unul lângă altul; pe telefon,
 * câte unul, schimbat la 6 secunde (se oprește la atingere sau hover).
 */
export function Ticker({ items }: { items: Item[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [paused, items.length]);
  if (!items.length) return null;
  const it = items[i % items.length];
  return (
    <div className="mx-auto max-w-[1320px] px-4 sm:px-8">
      <div className="ui flex items-start gap-6 border-b border-rule py-3">
        <div className="pt-[3px]">
          <Label />
        </div>
        {/* Desktop: trei subiecte */}
        <ol className="hidden min-w-0 flex-1 md:grid md:grid-cols-3">
          {items.slice(0, 3).map((x, k) => (
            <li key={x.href} className={k > 0 ? "min-w-0 border-l border-rule pl-5" : "min-w-0 pr-5"}>
              <Link href={x.href} className="group flex gap-2.5 text-[14px] leading-snug">
                <time className="mono shrink-0 pt-px text-[12px] text-ink-3" suppressHydrationWarning>
                  {formatTime(x.ts)}
                </time>
                <span className="line-clamp-2 font-semibold group-hover:underline">{x.title}</span>
              </Link>
            </li>
          ))}
        </ol>
        {/* Telefon: unul pe rând */}
        <div className="min-w-0 flex-1 md:hidden" aria-live="polite" onTouchStart={() => setPaused(true)}>
          <Link key={it.href} href={it.href} className="tick-in flex gap-2.5 text-[14px] leading-snug">
            <time className="mono shrink-0 pt-px text-[12px] text-ink-3" suppressHydrationWarning>
              {formatTime(it.ts)}
            </time>
            <span className="line-clamp-2 font-semibold">{it.title}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
