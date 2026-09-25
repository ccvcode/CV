"use client";

import { useEffect, useState } from "react";
import { formatDate, formatLongDate, timeAgo } from "@/lib/utils";

/** Timp relativ („acum 5 minute”) care se actualizează singur în fiecare minut. */
export function TimeAgo({ ts, className }: { ts: number; className?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    // Recalculăm imediat după hidratare: HTML-ul din cache poate fi generat acum câteva minute.
    tick((x) => x + 1);
    const t = setInterval(() => tick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <time dateTime={new Date(ts).toISOString()} title={formatDate(ts)} className={className} suppressHydrationWarning>
      {timeAgo(ts)}
    </time>
  );
}

/** Data de azi, calculată în browser (layout-ul din cache poate fi generat ieri). */
export function Today({ className }: { className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={className} suppressHydrationWarning>
      {formatLongDate(now)}
    </span>
  );
}
