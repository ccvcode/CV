"use client";

import { useEffect, useState } from "react";
import { formatDate, formatLongDate, formatTime, timeAgo } from "@/lib/core/utils";

function useTick(ms = 60_000) {
  const [, set] = useState(0);
  useEffect(() => {
    set((x) => x + 1); // recalculăm după hidratare (HTML-ul poate fi generat mai devreme)
    const t = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/** „acum 12 minute” — se actualizează singur. */
export function TimeAgo({ ts, className }: { ts: number; className?: string }) {
  useTick();
  return (
    <time dateTime={new Date(ts).toISOString()} title={formatDate(ts)} className={className} suppressHydrationWarning>
      {timeAgo(ts)}
    </time>
  );
}

/** Ora (HH:mm), în fusul orar al României. */
export function Clock({ ts, className }: { ts: number; className?: string }) {
  return (
    <time dateTime={new Date(ts).toISOString()} className={className} suppressHydrationWarning>
      {formatTime(ts)}
    </time>
  );
}

export function Today({ className }: { className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={className} suppressHydrationWarning>
      {formatLongDate(now ?? Date.now())}
    </span>
  );
}
