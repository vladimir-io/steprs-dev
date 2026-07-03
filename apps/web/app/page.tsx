import type { Metadata } from "next";

import { HomeShell } from "@/components/home/home-shell";
import { ToolsWorkspace } from "@/components/tools/tools-workspace";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: siteConfig.shortTitle,
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  alternates: {
    canonical: siteConfig.url,
  },
  openGraph: {
    type: "website",
    url: siteConfig.url,
    title: siteConfig.title,
    description: siteConfig.ogDescription,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} | STEP pre-flight before CAM`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.ogDescription,
    images: ["/og-image.png"],
  },
};

export default function HomePage() {
  return <HomeShell workspace={<ToolsWorkspace />} />;
}
