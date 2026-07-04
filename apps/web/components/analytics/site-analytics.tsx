"use client";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { productFlags } from "@/lib/product-flags";
import { initTelemetry } from "@/lib/telemetry";
import { useEffect } from "react";

/** Vercel metrics — off by default; enable only on private deployments. */
export function SiteAnalytics() {
  useEffect(() => {
    initTelemetry();
  }, []);

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
