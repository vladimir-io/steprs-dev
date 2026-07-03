import type { Metadata } from "next";
import Link from "next/link";

import { HexWordmark } from "@/components/brand/hex-wordmark";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <HexWordmark variant="loader" animate={false} size="md" />
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-sm text-[var(--color-muted)]">
          That URL does not exist on {siteConfig.name}. Return to the STEP
          check workbench.
        </p>
      </div>
      <Link
        href="/"
        className="btn-variant-default inline-flex rounded-full px-5 py-2.5 text-sm font-medium"
      >
        Back to home
      </Link>
    </div>
  );
}
