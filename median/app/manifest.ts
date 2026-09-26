import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Median",
    short_name: "Median",
    description: "Știrile zilei, cântărite.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#111110",
    lang: "ro",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
