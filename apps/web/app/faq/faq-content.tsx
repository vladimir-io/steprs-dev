import Link from "next/link";

import { HomeFaq } from "@/components/home/home-faq";

export function FaqPageContent() {
  return (
    <div className="home-shell faq-page">
      <Link href="/" className="faq-page__back">
        ← Back to parser
      </Link>
      <HomeFaq />
    </div>
  );
}
