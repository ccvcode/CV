import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Imaginile vin de pe zeci de domenii diferite (sursele RSS), așa că
  // folosim <img> simplu în loc de optimizarea next/image.
  images: { unoptimized: true },
  serverExternalPackages: ["undici"],
};

export default nextConfig;
