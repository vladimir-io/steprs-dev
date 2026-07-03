import type { Metadata } from "next";
import Link from "next/link";

import { HomeFaq } from "@/components/home/home-faq";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ",
  description: `Frequently asked questions about ${siteConfig.name} — privacy, parsing, and CAM handoff.`,
  alternates: {
    canonical: `${siteConfig.url}/faq`,
  },
};

export default function FaqPage() {
  return (
    <div className="home-shell faq-page">
      <Link href="/" className="faq-page__back">
        ← Back to parser
      </Link>
      <HomeFaq />
    </div>
  );
}
