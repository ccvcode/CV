"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Verifică la fiecare minut dacă au apărut știri noi (colectarea rulează la 5 minute) și afișează
 * o bară discretă „N știri noi ↑”. Titlul tab-ului primește numărul, ca „(3) Median”.
 */
export function LiveUpdater({ since }: { since: number }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const sinceRef = useRef(since);
  const base = useRef("");

  useEffect(() => {
    sinceRef.current = Math.max(sinceRef.current, since);
    setCount(0);
  }, [since]);

  useEffect(() => {
    base.current = document.title.replace(/^\(\d+\)\s*/, "");
    let alive = true;
    const check = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/api/nou?since=${sinceRef.current}`, { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { count: number };
        if (alive) setCount(d.count);
      } catch {}
    };
    const t = setInterval(check, 60_000);
    const vis = () => !document.hidden && check();
    document.addEventListener("visibilitychange", vis);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  useEffect(() => {
    if (base.current) document.title = count > 0 ? `(${count}) ${base.current}` : base.current;
  }, [count]);

  if (count <= 0) return null;
  return (
    <button
      onClick={() => {
        sinceRef.current = Date.now();
        setCount(0);
        window.scrollTo({ top: 0, behavior: "smooth" });
        router.refresh();
      }}
      className="ui fixed bottom-5 left-1/2 z-40 -translate-x-1/2 border border-rule-strong bg-paper px-4 py-2 text-[14px] font-semibold shadow-none hover:bg-ink hover:text-on-ink"
    >
      {count === 1 ? "O știre nouă ↑" : `${count > 50 ? "50+" : count} știri noi ↑`}
    </button>
  );
}
