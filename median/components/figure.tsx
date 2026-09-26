import type { Img } from "@/lib/core/types";
import { cx } from "@/lib/core/utils";

const RATIOS = { "3/2": "aspect-[3/2]", "4/3": "aspect-[4/3]", "16/9": "aspect-[16/9]", "21/9": "aspect-[21/9]", "4/5": "aspect-[4/5]", "1/1": "aspect-square" } as const;

/**
 * Imagine editorială: raport fix, culoarea dominantă ca fundal până la încărcare, credit
 * suprapus (discret, în colț) sau ca legendă sub imagine.
 */
export function Figure({
  img,
  ratio = "3/2",
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority,
  credit = "none",
  caption,
  className,
}: {
  img: Img;
  ratio?: keyof typeof RATIOS;
  sizes?: string;
  priority?: boolean;
  credit?: "overlay" | "caption" | "none";
  caption?: string;
  className?: string;
}) {
  const creditNode = img.creditUrl ? (
    <a href={img.creditUrl} target="_blank" rel="noopener noreferrer nofollow" className="relative z-[2] hover:underline">
      {img.credit}
    </a>
  ) : (
    img.credit
  );
  return (
    <figure className={cx("m-0", className)}>
      <div className={cx("figure", RATIOS[ratio])} style={{ backgroundColor: img.color }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.src}
          srcSet={img.srcSet}
          sizes={sizes}
          alt={caption ?? ""}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          referrerPolicy="no-referrer"
          width={img.width}
          height={img.height}
        />
        {credit === "overlay" && (
          <span className="mono absolute bottom-0 right-0 z-[2] bg-black/55 px-1.5 py-0.5 text-[10.5px] tracking-tight text-white/90">{img.credit}</span>
        )}
      </div>
      {(credit === "caption" || caption) && (
        <figcaption className="ui mt-2 text-[13px] leading-snug text-ink-2">
          {caption && <span>{caption} </span>}
          {credit === "caption" && <span className="text-[11px] uppercase tracking-wider text-ink-3">{creditNode}</span>}
          {img.license && credit === "caption" && img.licenseUrl && (
            <a href={img.licenseUrl} target="_blank" rel="noopener noreferrer nofollow" className="relative z-[2] ml-1 text-[11px] uppercase tracking-wider text-ink-3 hover:underline">
              · licență
            </a>
          )}
        </figcaption>
      )}
    </figure>
  );
}
