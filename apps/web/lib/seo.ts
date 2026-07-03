import type { Metadata } from "next";

import { absoluteUrl, siteConfig } from "@/lib/site";

const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: `${siteConfig.name} | STEP pre-flight before CAM`,
} as const;

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(opts.path);
  const ogTitle = `${opts.title} | ${siteConfig.name}`;

  return {
    title: opts.title,
    description: opts.description,
    keywords: opts.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: ogTitle,
      description: opts.description,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: opts.description,
      images: [OG_IMAGE.url],
    },
    ...(opts.noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}

export function homeMetadata(): Metadata {
  return {
    title: siteConfig.shortTitle,
    description: siteConfig.description,
    keywords: [...siteConfig.keywords],
    alternates: { canonical: siteConfig.url },
    openGraph: {
      type: "website",
      url: siteConfig.url,
      title: siteConfig.title,
      description: siteConfig.ogDescription,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: siteConfig.title,
      description: siteConfig.ogDescription,
      images: [OG_IMAGE.url],
    },
  };
}
