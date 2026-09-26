"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/core/categories";
import { cx } from "@/lib/core/utils";
import { Today } from "./time";

export const themeScript = `(function(){try{var t=localStorage.getItem('median-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}})()`;

function Wordmark({ size }: { size: "lg" | "sm" | "xs" }) {
  return (
    <span className={cx("masthead inline-flex items-end text-ink", size === "lg" ? "text-[44px] sm:text-[64px] lg:text-[88px]" : size === "sm" ? "text-[30px]" : "text-[26px]")}>
      Median
      <span aria-hidden className="mb-[0.08em] ml-[0.06em] inline-block h-[0.2em] w-[0.2em] bg-accent" />
    </span>
  );
}

const NAV = CATEGORIES.map((c) => ({ href: `/categorie/${c.slug}`, label: c.label }));

export function Masthead({ utility }: { utility: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [compact, setCompact] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { rootMargin: "0px" });
    io.observe(el);
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !/input|textarea/i.test((e.target as HTMLElement).tagName))) {
        e.preventDefault();
        setSearch(true);
      }
      if (e.key === "Escape") {
        setSearch(false);
        setMenu(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      io.disconnect();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    setMenu(false);
    setSearch(false);
  }, [pathname]);

  useEffect(() => {
    if (search) setTimeout(() => inputRef.current?.focus(), 20);
    document.body.style.overflow = menu || search ? "hidden" : "";
  }, [search, menu]);

  const toggleTheme = () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try {
      localStorage.setItem("median-theme", root.dataset.theme);
    } catch {}
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) router.push(`/cauta?q=${encodeURIComponent(q.trim())}`);
  };

  const navLinks = (cls: string) =>
    NAV.map((n) => {
      const active = pathname === n.href;
      return (
        <Link key={n.href} href={n.href} className={cx(cls, active ? "text-ink" : "text-ink-2 hover:text-ink")} aria-current={active ? "page" : undefined}>
          <span className={cx("border-b-2 pb-[3px]", active ? "border-accent" : "border-transparent")}>{n.label}</span>
        </Link>
      );
    });

  return (
    <>
      {/* Bara utilitară */}
      <div className="ui border-b border-rule text-[12px] text-ink-2">
        <div className="mx-auto flex h-8 max-w-[1320px] items-center gap-4 px-4 sm:px-8">
          <Today className="shrink-0 font-semibold text-ink first-letter:uppercase" />
          <div className="hidden min-w-0 items-center gap-4 overflow-hidden md:flex">{utility}</div>
          <div className="ml-auto flex items-center gap-4">
            <button onClick={() => setSearch(true)} className="hover:text-ink">
              Căutare
            </button>
            <button onClick={toggleTheme} className="hover:text-ink" aria-label="Schimbă tema">
              Temă ◐
            </button>
          </div>
        </div>
      </div>

      {/* Titlul mare */}
      <header className="mx-auto max-w-[1320px] px-4 sm:px-8">
        <div className="flex items-end justify-between gap-6 pb-4 pt-5 sm:pt-7">
          <Link href="/" aria-label="Median — prima pagină">
            <Wordmark size="lg" />
          </Link>
          <p className="dek mb-1 hidden text-right text-[18px] lg:block">
            Știrile zilei, cântărite.
            <span className="ui mt-1 block text-[12px] not-italic text-ink-3">Toate sursele. Un singur loc.</span>
          </p>
          <button onClick={() => setMenu(true)} className="ui mb-1 text-[13px] font-semibold uppercase tracking-wider sm:hidden">
            Meniu
          </button>
        </div>
        <div className="h-[2px] bg-rule-strong" />
        <nav aria-label="Secțiuni" className="no-scrollbar fade-right ui flex gap-7 overflow-x-auto whitespace-nowrap py-3 text-[14px] font-semibold sm:fade-right">
          <Link href="/" className={cx(pathname === "/" ? "text-ink" : "text-ink-2 hover:text-ink")}>
            <span className={cx("border-b-2 pb-[3px]", pathname === "/" ? "border-accent" : "border-transparent")}>Prima pagină</span>
          </Link>
          {navLinks("")}
          <Link href="/pe-scurt" className={cx(pathname === "/pe-scurt" ? "text-ink" : "text-ink-2 hover:text-ink")}>
            <span className={cx("border-b-2 pb-[3px]", pathname === "/pe-scurt" ? "border-accent" : "border-transparent")}>Pe scurt</span>
          </Link>
        </nav>
        <div className="h-px bg-rule" />
      </header>
      <div ref={sentinel} aria-hidden className="h-0" />

      {/* Bara fixă compactă */}
      <div
        className={cx(
          "fixed inset-x-0 top-0 z-40 border-b border-rule bg-paper transition-transform duration-200 [transition-timing-function:cubic-bezier(.2,.7,.2,1)]",
          compact ? "translate-y-0" : "-translate-y-full"
        )}
        aria-hidden={!compact}
      >
        <div className="mx-auto flex h-[52px] max-w-[1320px] items-center gap-6 px-4 sm:px-8">
          <Link href="/" tabIndex={compact ? 0 : -1} aria-label="Median">
            <Wordmark size="xs" />
          </Link>
          <nav className="no-scrollbar fade-right ui hidden flex-1 gap-6 overflow-x-auto whitespace-nowrap text-[13px] font-semibold md:flex">{navLinks("")}</nav>
          <div className="ui ml-auto flex items-center gap-4 text-[13px] font-semibold">
            <button onClick={() => setSearch(true)} tabIndex={compact ? 0 : -1}>
              Căutare
            </button>
            <button onClick={() => setMenu(true)} className="md:hidden" tabIndex={compact ? 0 : -1}>
              Meniu
            </button>
          </div>
        </div>
      </div>

      {/* Meniul pe tot ecranul (mobil) */}
      {menu && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-paper px-5 pb-10 pt-4" role="dialog" aria-modal="true" aria-label="Meniu">
          <div className="flex items-center justify-between border-b-2 border-rule-strong pb-3">
            <Wordmark size="sm" />
            <button onClick={() => setMenu(false)} className="ui text-[13px] font-semibold uppercase tracking-wider">
              Închide
            </button>
          </div>
          <ul className="mt-2">
            {[{ href: "/", label: "Prima pagină" }, ...NAV, { href: "/pe-scurt", label: "Pe scurt" }, { href: "/salvate", label: "Salvate" }].map((n) => (
              <li key={n.href} className="border-b border-rule">
                <Link href={n.href} className="section-head block py-3 text-[32px]">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="ui mt-6 flex gap-5 text-[13px] text-ink-2">
            <Link href="/despre">Despre</Link>
            <Link href="/surse">Surse</Link>
            <Link href="/politica-ai">Politica AI</Link>
            <button onClick={toggleTheme}>Temă ◐</button>
          </div>
        </div>
      )}

      {/* Căutare */}
      {search && (
        <div className="fixed inset-0 z-50 bg-paper/95" role="dialog" aria-modal="true" aria-label="Căutare" onClick={() => setSearch(false)}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="mx-auto mt-[12vh] max-w-3xl px-5">
            <label className="kicker text-ink-3" htmlFor="q">
              Caută în arhiva Median
            </label>
            <input
              id="q"
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ex. buget, Ucraina, Superliga"
              className="hl mt-2 block w-full rounded-[2px] border-b-2 border-rule-strong bg-transparent py-3 text-[34px] outline-none placeholder:text-ink-3 sm:text-[44px]"
            />
            <div className="ui mt-4 flex justify-between text-[13px] text-ink-3">
              <span>Enter pentru a căuta · Esc pentru a închide</span>
              <button type="button" onClick={() => setSearch(false)} className="font-semibold text-ink">
                Închide
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
