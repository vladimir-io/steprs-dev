import type { MetadataRoute } from "next";

import { absoluteUrl, siteConfig } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: siteConfig.title,
    short_name: "steprs",
    description: siteConfig.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f5f7",
    theme_color: "#f5f5f7",
    lang: "en",
    categories: ["productivity", "utilities", "business"],
    icons: [
      {
        src: "/favicon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/favicon-96x96.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: "/favicon-48x48.png",
        sizes: "48x48",
        type: "image/png",
      },
    ],
  };
}
