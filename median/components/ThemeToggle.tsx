"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export const themeScript = `(function(){try{var t=localStorage.getItem('median-theme');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})()`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<string | null>(null);
  useEffect(() => setTheme(document.documentElement.dataset.theme ?? "light"), []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("median-theme", next);
    } catch {}
    setTheme(next);
  };
  return (
    <button
      onClick={toggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-2 hover:text-ink"
      aria-label={theme === "dark" ? "Temă luminoasă" : "Temă întunecată"}
      title="Schimbă tema"
    >
      {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
