"use client";

import { useState } from "react";
import { cx, faviconUrl } from "@/lib/utils";

const PALETTE = ["#3A2BFF", "#C81D4E", "#0E9F6E", "#0891B2", "#F97316", "#7C3AED", "#B45309", "#DB2777"];

export function Favicon({ name, site, size = 16, className }: { name: string; site: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const color = PALETTE[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % PALETTE.length];
  return (
    <span
      className={cx("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-surface", className)}
      style={{ width: size, height: size, background: failed ? color : "var(--surface-2)" }}
      title={name}
    >
      {failed ? (
        <span className="font-bold text-white" style={{ fontSize: size * 0.55 }}>
          {name[0]}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={faviconUrl(site)} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      )}
    </span>
  );
}
