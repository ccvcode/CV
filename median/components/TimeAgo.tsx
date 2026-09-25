"use client";

import { useEffect, useState } from "react";
import { formatDate, timeAgo } from "@/lib/utils";

/** Timp relativ („acum 5 minute”) care se actualizează singur în fiecare minut. */
export function TimeAgo({ ts, className }: { ts: number; className?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <time dateTime={new Date(ts).toISOString()} title={formatDate(ts)} className={className} suppressHydrationWarning>
      {timeAgo(ts)}
    </time>
  );
}
