import { Car, Cpu, Globe, HeartPulse, Landmark, MapPin, Palette, Sparkles, Star, TrendingUp, Trophy, type LucideProps } from "lucide-react";
import type { CategorySlug } from "@/lib/types";

const ICONS: Record<CategorySlug, React.ComponentType<LucideProps>> = {
  national: MapPin,
  politica: Landmark,
  economie: TrendingUp,
  international: Globe,
  sport: Trophy,
  tech: Cpu,
  lifestyle: Sparkles,
  sanatate: HeartPulse,
  auto: Car,
  cultura: Palette,
  monden: Star,
};

export function CategoryIcon({ slug, ...props }: { slug: CategorySlug } & LucideProps) {
  const Icon = ICONS[slug] ?? MapPin;
  return <Icon {...props} />;
}
