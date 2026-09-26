"use client";

import { useEffect, useState } from "react";

const KEY = "median-salvate";

export interface Saved {
  id: string;
  href: string;
  title: string;
  ts: number;
}

export function readSaved(): Saved[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

/** Distribuire (link, WhatsApp, Facebook, X) + salvare pentru mai târziu + înregistrarea vizualizării. */
export function ArticleTools({ item, vertical }: { item: Saved; vertical?: boolean }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(window.location.href);
    setSaved(readSaved().some((s) => s.id === item.id));
  }, [item.id]);

  const toggle = () => {
    const list = readSaved().filter((s) => s.id !== item.id);
    const next = saved ? list : [item, ...list].slice(0, 200);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    setSaved(!saved);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  const enc = encodeURIComponent(url);
  const t = encodeURIComponent(item.title);
  const cls = "ui text-[12px] font-semibold uppercase tracking-wider text-ink-2 hover:text-ink";
  return (
    <div className={vertical ? "flex flex-col items-start gap-3" : "flex flex-wrap items-center gap-x-5 gap-y-2"}>
      <button onClick={copy} className={cls}>
        {copied ? "Link copiat" : "Copiază linkul"}
      </button>
      <a className={cls} href={`https://wa.me/?text=${t}%20${enc}`} target="_blank" rel="noopener noreferrer">
        WhatsApp
      </a>
      <a className={cls} href={`https://www.facebook.com/sharer/sharer.php?u=${enc}`} target="_blank" rel="noopener noreferrer">
        Facebook
      </a>
      <a className={cls} href={`https://x.com/intent/post?url=${enc}&text=${t}`} target="_blank" rel="noopener noreferrer">
        X
      </a>
      <button onClick={toggle} className={cls} aria-pressed={saved}>
        {saved ? "Salvat ■" : "Salvează □"}
      </button>
    </div>
  );
}

export function ViewBeacon({ id }: { id: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      navigator.sendBeacon?.("/api/view", JSON.stringify({ id })) ||
        fetch("/api/view", { method: "POST", body: JSON.stringify({ id }), keepalive: true }).catch(() => {});
    }, 4000); // contează doar vizitele de cel puțin câteva secunde
    return () => clearTimeout(t);
  }, [id]);
  return null;
}

export function ReadingProgress() {
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
    <div aria-hidden className="fixed inset-x-0 top-0 z-50 h-[2px]">
      <div className="h-full origin-left bg-accent" style={{ transform: `scaleX(${p})` }} />
    </div>
  );
}
