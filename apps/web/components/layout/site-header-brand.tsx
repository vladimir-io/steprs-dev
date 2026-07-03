"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { HexWordmark } from "@/components/brand/hex-wordmark";
import { dispatchWorkspaceReset } from "@/lib/workspace-reset";

export function SiteHeaderBrand() {
  const pathname = usePathname();
  const router = useRouter();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname !== "/") return;

    event.preventDefault();
    dispatchWorkspaceReset();
    router.replace("/", { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Link
      href="/"
      className="site-header__brand"
      aria-label="STEPrs home, reset workspace"
      onClick={handleClick}
    >
      <HexWordmark variant="header" showDomain size="sm" />
    </Link>
  );
}
