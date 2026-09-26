import Link from "next/link";
import { CATEGORY_MAP, REGION_MAP } from "@/lib/core/categories";
import type { StoryCard } from "@/lib/data/queries";
import { cx } from "@/lib/core/utils";
import { Figure } from "./figure";
import { TimeAgo } from "./time";

/** Poza de afișat într-o listă: coperta generată nu se folosește în liste (ar repeta titlul). */
export function listImage(s: StoryCard) {
  if (s.hero && s.hero.kind !== "card") return s.hero;
  return s.thumb;
}

export function Kicker({ story, className, showRegion = true }: { story: StoryCard; className?: string; showRegion?: boolean }) {
  const cat = CATEGORY_MAP[story.category];
  const region = showRegion && story.region && story.region !== "lume" ? REGION_MAP[story.region]?.label : undefined;
  return (
    <div className={cx("kicker flex items-center gap-2", className)}>
      {story.breaking && <span className="text-accent">Ultima oră</span>}
      <span className="text-ink-2">{region ?? (story.category === "international" ? "Lume" : cat?.short)}</span>
    </div>
  );
}

/** Eticheta surselor: „Digi24, HotNews +2” (numele primelor publicații, în ordinea încrederii). */
export function sourcesLabel(s: StoryCard, max = 2): string {
  const names = s.sources.map((x) => x.name);
  if (!names.length) return "";
  const extra = names.length - max;
  return names.slice(0, max).join(", ") + (extra > 0 ? ` +${extra}` : "");
}

export function sourcesCount(s: StoryCard): string {
  return s.sourceCount > 1 ? `${s.sourceCount} surse` : "o sursă";
}

export function Meta({ story, className, reading }: { story: StoryCard; className?: string; reading?: boolean }) {
  return (
    <div className={cx("meta flex flex-wrap items-center gap-x-2 gap-y-0.5", className)}>
      <TimeAgo ts={story.published} className="whitespace-nowrap" />
      <span aria-hidden>·</span>
      <span className="whitespace-nowrap" title={story.sources.map((x) => x.name).join(", ")}>
        {sourcesCount(story)}
      </span>
      {reading && story.kind === "full" && (
        <>
          <span aria-hidden>·</span>
          <span>{story.readingTime} min</span>
        </>
      )}
    </div>
  );
}

function Headline({ story, size, className, as: Tag = "h3" }: { story: StoryCard; size: "xl" | "lg" | "md" | "sm"; className?: string; as?: "h2" | "h3" }) {
  return (
    <Tag className={cx("hl", size === "xl" ? leadClass(story.title) : `hl-${size}`, size === "md" && "line-clamp-5", size === "sm" && "line-clamp-4", className)}>
      <Link href={story.href} className="stretched">
        {story.title}
      </Link>
    </Tag>
  );
}

/** Mărimea titlului principal după lungime (titlurile lungi nu umplu tot ecranul). */
export function leadClass(title: string): string {
  if (title.length <= 55) return "hl-xl";
  if (title.length <= 75) return "hl-xl !text-[clamp(30px,3.1vw,44px)]";
  return "hl-lg !text-[clamp(26px,2.5vw,34px)]";
}

/** Blocul standard: imagine sus (opțional), supratitlu, titlu, sub-titlu, meta. */
export function StoryBlock({
  story,
  size = "md",
  image = true,
  ratio = "3/2",
  dek = false,
  priority,
  sizes,
  className,
}: {
  story: StoryCard;
  size?: "xl" | "lg" | "md" | "sm";
  image?: boolean;
  ratio?: "3/2" | "16/9" | "1/1" | "21/9";
  dek?: boolean;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const img = image ? listImage(story) : undefined;
  return (
    <article className={cx("group relative", className)}>
      {img && <Figure img={img} ratio={ratio} priority={priority} sizes={sizes} className="mb-3" />}
      <Kicker story={story} className="mb-1.5" />
      <Headline story={story} size={img || size !== "md" ? size : "lg"} />
      {dek && story.dek && <p className={cx("dek mt-2", size === "xl" ? "text-xl" : "text-[17px]")}>{story.dek}</p>}
      <Meta story={story} className="mt-2" />
    </article>
  );
}

/** Rând compact: titlu + meta, cu miniatură pătrată opțională în dreapta. */
export function StoryRow({ story, thumb = false, kicker = true, className }: { story: StoryCard; thumb?: boolean; kicker?: boolean; className?: string }) {
  const img = thumb ? listImage(story) : undefined;
  return (
    <article className={cx("group relative flex gap-4", className)}>
      <div className="min-w-0 flex-1">
        {kicker && <Kicker story={story} className="mb-1" />}
        <Headline story={story} size="sm" />
        <Meta story={story} className="mt-1.5" />
      </div>
      {img && <Figure img={img} ratio="1/1" sizes="96px" className="w-20 shrink-0 sm:w-24" />}
    </article>
  );
}

/** Link text simplu, precedat de linie (pentru subiectele legate de știrea principală). */
export function StoryLink({ story }: { story: StoryCard }) {
  return (
    <li className="group relative flex gap-2 border-t border-rule py-2.5 first:border-t-0">
      <span aria-hidden className="mt-[11px] h-px w-3 shrink-0 bg-ink-3" />
      <div>
        <h4 className="hl hl-sm">
          <Link href={story.href} className="stretched">
            {story.title}
          </Link>
        </h4>
        <div className="meta mt-1">{sourcesLabel(story)}</div>
      </div>
    </li>
  );
}
