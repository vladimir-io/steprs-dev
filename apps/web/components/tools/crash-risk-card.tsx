"use client";

/* Dynamic SVG data URLs — next/image cannot render generated diagnostic cards. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  buildCrashRiskSvg,
  pickCrashRiskCheck,
  svgDataUrl,
  svgToPngBlob,
} from "@/lib/preflight/crash-risk-card";
import type { PreflightCheck } from "@/lib/preflight/engine";
import {
  buildCrashRiskTweet,
  downloadBlob,
  openXIntent,
  shareImageToX,
} from "@/lib/preflight/x-share";

interface CrashRiskCardProps {
  checks: PreflightCheck[];
  machineLabel: string;
  machinabilityScore: number;
  fileName?: string;
  reportUrl?: string;
}

export function CrashRiskCard({
  checks,
  machineLabel,
  machinabilityScore,
  fileName,
  reportUrl,
}: CrashRiskCardProps) {
  const [status, setStatus] = useState<string | null>(null);
  const crash = useMemo(() => pickCrashRiskCheck(checks), [checks]);

  const svg = useMemo(() => {
    if (!crash) return null;
    return buildCrashRiskSvg({
      check: crash,
      machineLabel,
      machinabilityScore,
      fileName,
    });
  }, [crash, machineLabel, machinabilityScore, fileName]);

  const tweet = useMemo(() => {
    if (!crash) return "";
    return buildCrashRiskTweet({
      machineLabel,
      checkTitle: crash.title,
      reportUrl,
    });
  }, [crash, machineLabel, reportUrl]);

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 4000);
  }, []);

  const handlePostToX = useCallback(async () => {
    if (!svg || !crash) return;
    const png = await svgToPngBlob(svg);
    const mode = await shareImageToX(png, tweet, "steprs-crash-risk.png");
    if (mode === "shared") flash("Shared to X");
    else if (mode === "clipboard") flash("Image copied — paste into your post");
    else flash("Card downloaded — attach to your post");
  }, [svg, crash, tweet, flash]);

  const handleDownload = useCallback(async () => {
    if (!svg) return;
    const png = await svgToPngBlob(svg);
    await downloadBlob(png, "steprs-crash-risk.png");
    flash("PNG saved");
  }, [svg, flash]);

  const handleTweetOnly = useCallback(() => {
    openXIntent(tweet);
  }, [tweet]);

  if (!crash || !svg) return null;

  return (
    <section className="crash-risk-card" data-testid="crash-risk-card">
      <img
        className="crash-risk-card__preview"
        src={svgDataUrl(svg)}
        alt={`Crash risk: ${crash.title}`}
        width={600}
        height={315}
      />
      <div className="crash-risk-card__actions">
        <Button type="button" variant="glow" size="sm" onClick={handlePostToX}>
          Post to X
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
          Download card
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={handleTweetOnly}>
          Tweet text only
        </Button>
      </div>
      {status && <p className="crash-risk-card__status">{status}</p>}
    </section>
  );
}
