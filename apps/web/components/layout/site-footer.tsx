import Link from "next/link";

import { absoluteUrl, siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p className="site-footer__meta">
          steprs.dev · open-core WASM · v{siteConfig.engineVersion}
        </p>
        <nav className="site-footer__links" aria-label="Site links">
          <Link href="/faq">FAQ</Link>
          <Link href="/privacy">Privacy</Link>
          <a href={absoluteUrl("/llms.txt")}>llms.txt</a>
          <a href={absoluteUrl("/sitemap.xml")}>Sitemap</a>
          <a
            href={siteConfig.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
