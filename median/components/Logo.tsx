import { cx } from "@/lib/utils";

/** Wordmark „median”: punctul lui „i” este înlocuit de o linie mediană în culoarea brandului. */
export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-5xl" : size === "sm" ? "text-2xl" : "text-[2rem]";
  return (
    <span className={cx("font-display inline-flex items-baseline font-black leading-none tracking-tight text-ink", text, className)} aria-label="Median">
      <span aria-hidden>med</span>
      <span aria-hidden className="relative">
        ı
        <span className="absolute left-1/2 top-[0.02em] h-[0.09em] w-[0.42em] -translate-x-1/2 rounded-full bg-brand" />
      </span>
      <span aria-hidden>an</span>
      <span aria-hidden className="ml-[0.06em] inline-block h-[0.16em] w-[0.16em] translate-y-[-0.02em] rounded-full bg-breaking" />
    </span>
  );
}
