import type { MetadataRoute } from "next";
import { config } from "@/lib/core/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/cauta"] }],
    sitemap: [`${config.siteUrl}/sitemap.xml`, `${config.siteUrl}/news-sitemap.xml`],
  };
}
