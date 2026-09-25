"use client";

import { Bookmark, BookmarkCheck, Check, Link2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Article } from "@/lib/types";
import { cx } from "@/lib/utils";

export type SavedArticle = Pick<Article, "id" | "slug" | "title" | "summary" | "image" | "sourceName" | "sourceSite" | "category" | "published" | "link" | "readingTime">;

const KEY = "median-saved";

export function readSaved(): SavedArticle[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function writeSaved(list: SavedArticle[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)));
    window.dispatchEvent(new Event("median-saved"));
  } catch {}
}

export function ArticleActions({ article }: { article: SavedArticle }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [anim, setAnim] = useState(0);

  useEffect(() => {
    setSaved(readSaved().some((a) => a.id === article.id));
    // Înregistrăm o vizualizare pentru clasamentul „Cele mai citite”.
    fetch("/api/view", { method: "POST", body: JSON.stringify({ id: article.id }), headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  }, [article.id]);

  const toggleSave = () => {
    const list = readSaved();
    const next = saved ? list.filter((a) => a.id !== article.id) : [article, ...list.filter((a) => a.id !== article.id)];
    writeSaved(next);
    setSaved(!saved);
    setAnim((x) => x + 1);
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: article.title, url });
        return;
      } catch {}
    }
    await navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const btn = "inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium transition hover:border-ink-faint";
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={toggleSave} className={cx(btn, saved && "border-brand text-brand")} aria-pressed={saved}>
        <span key={anim} className={anim ? "pop" : undefined}>
          {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </span>
        {saved ? "Salvat" : "Salvează"}
      </button>
      <button onClick={share} className={btn}>
        {copied ? <Check className="h-4 w-4 text-live" /> : <Share2 className="h-4 w-4" />}
        {copied ? "Link copiat" : "Distribuie"}
      </button>
      <a
        className={cx(btn, "hidden sm:inline-flex")}
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(article.link)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Link2 className="h-4 w-4" /> Facebook
      </a>
    </div>
  );
}
