"use client";

import { ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const POLL_MS = 60_000;

/**
 * Verifică periodic dacă serverul a colectat știri noi (colectarea rulează la 5 minute)
 * și afișează un buton discret „N știri noi”, fără să reîncarce pagina din senin.
 */
export function LiveUpdater({ since }: { since: number }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const sinceRef = useRef(since);
  const baseTitle = useRef<string>("");

  useEffect(() => {
    sinceRef.current = since;
    setCount(0);
  }, [since]);

  useEffect(() => {
    baseTitle.current = document.title.replace(/^\(\d+\)\s*/, "");
    let stop = false;
    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/news?since=${sinceRef.current}&limit=50&fields=id`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { count: number };
        if (!stop) setCount(data.count);
      } catch {}
    };
    const t = setInterval(check, POLL_MS);
    const onVis = () => !document.hidden && check();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (!baseTitle.current) return;
    document.title = count > 0 ? `(${count}) ${baseTitle.current}` : baseTitle.current;
  }, [count]);

  if (count <= 0) return null;
  return (
    <button
      onClick={() => {
        setCount(0);
        window.scrollTo({ top: 0, behavior: "smooth" });
        router.refresh();
      }}
      className="glass toast-in fixed left-1/2 top-24 z-50 inline-flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink shadow-xl"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
        <ArrowUp className="h-3.5 w-3.5" />
      </span>
      {count === 1 ? "O știre nouă" : `${count >= 50 ? "50+" : count} știri noi`}
    </button>
  );
}
