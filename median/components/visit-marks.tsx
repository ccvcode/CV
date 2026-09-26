"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";

/** Încarcă /visit.js și remarchează știrile noi la fiecare navigare în site. */
export function VisitMarks() {
  const path = usePathname();
  useEffect(() => {
    const w = window as unknown as { medianMark?: () => void };
    const t = setTimeout(() => w.medianMark?.(), 50);
    return () => clearTimeout(t);
  }, [path]);
  return <Script src="/visit.js" strategy="afterInteractive" />;
}
