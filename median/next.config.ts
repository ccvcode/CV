import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  // Module native / grele: rămân în node_modules, nu intră în bundle.
  serverExternalPackages: ["better-sqlite3", "sharp", "undici", "linkedom", "@mozilla/readability", "satori", "@resvg/resvg-js", "probe-image-size", "web-push"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      // Service worker-ul notificărilor: mereu versiunea curentă.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
