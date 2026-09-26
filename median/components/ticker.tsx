"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatTime } from "@/lib/core/utils";

/** Banda „ULTIMA ORĂ”: o știre pe rând, schimbată la 6 secunde (se oprește la hover). */
export function Ticker({ items }: { items: { href: string; title: string; ts: number }[] }) {
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
    <div className="bg-band text-on-band" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="mx-auto flex h-9 max-w-[1320px] items-stretch px-4 sm:px-8">
        <Link href="/pe-scurt" className="kicker -ml-4 flex shrink-0 items-center bg-accent px-3 text-white sm:-ml-8 sm:px-4">
          Ultima oră
        </Link>
        <div className="relative min-w-0 flex-1 overflow-hidden" aria-live="polite">
          <Link key={it.href} href={it.href} className="tick-in ui flex h-9 items-center gap-3 truncate pl-4 text-[14px] hover:underline">
            <span className="mono shrink-0 text-[12px] opacity-70">{formatTime(it.ts)}</span>
            <span className="truncate font-medium">{it.title}</span>
          </Link>
        </div>
        <span className="mono hidden shrink-0 items-center text-[11px] opacity-60 sm:flex">
          {i + 1}/{items.length}
        </span>
      </div>
    </div>
  );
}
