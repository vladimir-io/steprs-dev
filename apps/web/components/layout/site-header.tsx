import Link from "next/link";

import { SiteHeaderBrand } from "@/components/layout/site-header-brand";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { siteConfig } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="site-header__start">
          <SiteHeaderBrand />

          <nav className="site-header__menu" aria-label="Site">
            <Link href="/faq" className="site-header__menu-link">
              FAQ
            </Link>
            <a
              href={siteConfig.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="site-header__menu-link"
            >
              GitHub
            </a>
          </nav>
        </div>

        <div className="site-header__end">
          <Link href="/faq" className="site-header__mobile-link">
            FAQ
          </Link>
          <ThemeToggle className="site-header__theme" />
        </div>
      </div>
    </header>
  );
}
