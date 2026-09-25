import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Median — Știri",
    short_name: "Median",
    description: "Știri din România și din lume, actualizate la fiecare 5 minute.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf7",
    theme_color: "#3a2bff",
    lang: "ro",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
