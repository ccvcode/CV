"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bookmark, Radio, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { cx } from "@/lib/utils";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function Header({ utility }: { utility: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !/input|textarea/i.test((e.target as HTMLElement).tagName))) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 30);
  }, [searchOpen]);

  // Aducem în vizor categoria activă pe mobil.
  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>("[data-active=true]")?.scrollIntoView({ inline: "center", block: "nearest" });
    setSearchOpen(false);
  }, [pathname]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) router.push(`/cauta?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <>
      <div className="border-b border-line bg-surface">{utility}</div>
      <header className={cx("glass sticky top-0 z-40 border-b transition-[box-shadow,border-color] duration-300", scrolled ? "border-line shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)]" : "border-transparent")}>
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className={cx("shrink-0 transition-all duration-300", scrolled ? "py-2.5" : "py-4")} aria-label="Median — prima pagină">
            <Logo size={scrolled ? "sm" : "md"} />
          </Link>
          <div className="hidden flex-1 lg:block" />
          <nav className="ml-auto flex items-center gap-1">
            <Link href="/live" className={cx("hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition sm:inline-flex", pathname === "/live" ? "bg-breaking text-white" : "text-breaking hover:bg-breaking/10")}>
              <span className="pulse-dot h-2 w-2 rounded-full bg-current" />
              Live
            </Link>
            <Link href="/salvate" className="hidden h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-2 hover:text-ink sm:inline-flex" aria-label="Articole salvate" title="Salvate">
              <Bookmark className="h-[18px] w-[18px]" />
            </Link>
            <button
              onClick={() => setSearchOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm text-ink-muted transition hover:border-ink-faint hover:text-ink"
              aria-label="Caută"
            >
              <Search className="h-4 w-4" />
              <span className="hidden md:inline">Caută știri…</span>
              <kbd className="hidden rounded border border-line px-1.5 text-[10px] font-semibold md:inline">⌘K</kbd>
            </button>
            <ThemeToggle />
          </nav>
        </div>
        <div ref={navRef} className="no-scrollbar mx-auto flex max-w-7xl snap-x gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          <NavPill href="/" active={pathname === "/"}>
            Acasă
          </NavPill>
          {CATEGORIES.map((c) => (
            <NavPill key={c.slug} href={`/categorie/${c.slug}`} active={pathname === `/categorie/${c.slug}`} color={c.color}>
              {c.label}
            </NavPill>
          ))}
          <NavPill href="/live" active={pathname === "/live"}>
            <Radio className="h-3.5 w-3.5" /> Pe scurt
          </NavPill>
        </div>
      </header>

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setSearchOpen(false)}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="fade-up w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
            <div className="flex items-center gap-3 px-5">
              <Search className="h-5 w-5 text-ink-muted" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Caută în mii de știri din toate sursele…"
                className="h-16 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-ink-faint"
                aria-label="Termen de căutare"
              />
              <button type="button" onClick={() => setSearchOpen(false)} className="rounded-full p-1.5 text-ink-muted hover:bg-surface-2" aria-label="Închide">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line px-5 py-3 text-xs text-ink-muted">
              <span className="py-1">Sugestii:</span>
              {["Guvern", "BNR", "Ucraina", "Superliga", "inteligență artificială", "vremea"].map((s) => (
                <button key={s} type="button" onClick={() => router.push(`/cauta?q=${encodeURIComponent(s)}`)} className="rounded-full bg-surface-2 px-2.5 py-1 font-medium text-ink hover:bg-surface-3">
                  {s}
                </button>
              ))}
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function NavPill({ href, active, color, children }: { href: string; active: boolean; color?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      data-active={active}
      className={cx(
        "inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
        active ? "bg-ink text-bg" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
      )}
      style={active && color ? { background: color, color: "white" } : undefined}
    >
      {children}
    </Link>
  );
}
