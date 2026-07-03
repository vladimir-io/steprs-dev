"use client";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { productFlags } from "@/lib/product-flags";

/** Vercel metrics — off by default; enable only on private deployments. */
export function SiteAnalytics() {
  if (!productFlags.analyticsEnabled) {
    return null;
  }

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
