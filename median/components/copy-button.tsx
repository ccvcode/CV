"use client";

import { useState } from "react";

/** Copiază un text (ex. rezumatul zilei, gata de trimis pe WhatsApp). */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {}
      }}
    >
      {done ? "Copiat ✓" : label}
    </button>
  );
}
