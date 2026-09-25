"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORY_MAP } from "@/lib/categories";
import type { CategorySlug } from "@/lib/types";
import { cx } from "@/lib/utils";
import { CategoryIcon } from "./CategoryIcon";

interface Props {
  src?: string;
  alt: string;
  category: CategorySlug;
  className?: string;
  priority?: boolean;
  zoom?: boolean;
}

/** Imagine de articol cu fallback elegant (gradient în culoarea categoriei) dacă lipsește sau nu se încarcă. */
export function ArticleImage({ src, alt, category, className, priority, zoom = true }: Props) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // Dacă imaginea a eșuat înainte de hidratare, onError nu mai apucă să ruleze.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);
  const color = CATEGORY_MAP[category]?.color ?? "#3A2BFF";
  // Când imaginea e folosită ca fundal (absolute), nu adăugăm „relative”, care ar anula poziționarea.
  const position = className?.includes("absolute") ? "" : "relative";
  if (!src || failed) {
    return (
      <div
        className={cx(position, "flex items-center justify-center overflow-hidden", className)}
        style={{
          background: `radial-gradient(120% 120% at 0% 0%, ${color}55 0%, transparent 55%), radial-gradient(100% 100% at 100% 100%, ${color}40 0%, transparent 60%), linear-gradient(135deg, ${color}22, ${color}0d)`,
        }}
        aria-hidden
      >
        <CategoryIcon slug={category} className="h-1/3 max-h-24 w-1/3 max-w-24 opacity-25" style={{ color }} strokeWidth={1.25} />
      </div>
    );
  }
  return (
    <div className={cx(position, "overflow-hidden bg-surface-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cx("h-full w-full object-cover", zoom && "img-zoom")}
      />
    </div>
  );
}
