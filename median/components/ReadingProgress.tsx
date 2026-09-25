"use client";

import { useEffect, useState } from "react";

export function ReadingProgress({ color }: { color?: string }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-[3px]" aria-hidden>
      <div className="h-full origin-left" style={{ transform: `scaleX(${p})`, background: color ?? "var(--brand)" }} />
    </div>
  );
}
