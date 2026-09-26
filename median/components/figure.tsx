import type { Img } from "@/lib/core/types";
import { cx } from "@/lib/core/utils";

/*
 * Rapoarte de aspect: 3/2 pentru toate blocurile cu poză, 1/1 pentru miniaturi, 16/9 doar pe pagina
 * de articol și 21/9 pentru banda „revistă” (numai cu poze foarte late). Un rând are un singur raport.
 */
const RATIOS = { "3/2": "aspect-[3/2]", "16/9": "aspect-[16/9]", "21/9": "aspect-[21/9]", "1/1": "aspect-square" } as const;
const RATIO_VALUE: Record<keyof typeof RATIOS, number> = { "3/2": 1.5, "16/9": 16 / 9, "21/9": 21 / 9, "1/1": 1 };

/** Lățimea maximă (px CSS) a locului, din atributul `sizes` („(max-width: 1024px) 100vw, 760px” → 760). */
export function slotWidth(sizes: string): number {
  const last = sizes.split(",").pop()!.trim();
  const px = /^(\d+)px$/.exec(last);
  return px ? Number(px[1]) : 1320; // „100vw” sau calc(...): locul ocupă toată lățimea (containerul are max. 1320px)
}

/**
 * Câți pixeli din sursă ajung pe lățimea locului după decupare („cover”): o poză panoramică pusă
 * într-un loc mai îngust pierde laturile, deci are nevoie de mai mulți pixeli.
 */
export function usablePixels(img: Img, ratio: keyof typeof RATIOS): number {
  const w = img.maxWidth ?? img.width;
  const imgRatio = img.width / Math.max(1, img.height);
  return w * Math.min(1, RATIO_VALUE[ratio] / imgRatio);
}

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
  // Mod „soft”: poza e mult prea mică pentru loc (o mărire de peste 1,25x s-ar vedea neclar) sau are alt
  // format (portret, emblemă). O arătăm întreagă, la mărimea ei reală, centrată pe un fundal neutru.
  const slot = slotWidth(sizes);
  const imgRatio = img.width / Math.max(1, img.height);
  const soft =
    ratio !== "1/1" && (usablePixels(img, ratio) < slot * 0.8 || imgRatio < RATIO_VALUE[ratio] * 0.72 || imgRatio > RATIO_VALUE[ratio] * 1.9);
  const creditNode = img.creditUrl ? (
    <a href={img.creditUrl} target="_blank" rel="noopener noreferrer nofollow" className="relative z-[2] hover:underline">
      {img.credit}
    </a>
  ) : (
    img.credit
  );
  return (
    <figure className={cx("m-0", className)}>
      <div className={cx("figure", RATIOS[ratio], soft && "figure-soft")} style={soft ? undefined : { backgroundColor: img.color }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          data-slot={Math.round(soft ? Math.min(slot, img.maxWidth ?? img.width) : slot / Math.min(1, RATIO_VALUE[ratio] / imgRatio))}
          style={soft ? { maxWidth: `min(100%, ${img.maxWidth ?? img.width}px)` } : undefined}
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
