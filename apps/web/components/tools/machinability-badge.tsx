"use client";

/* Dynamic SVG data URLs — next/image cannot render generated diagnostic cards. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  buildMachinabilityFlexSvg,
  svgDataUrl,
  svgToPngBlob,
} from "@/lib/preflight/crash-risk-card";
import { getMachinabilityTier } from "@/lib/preflight/machinability-tier";
import { cn } from "@/lib/utils";
import {
  buildScoreFlexTweet,
  downloadBlob,
  openXIntent,
  shareImageToX,
} from "@/lib/preflight/x-share";

interface MachinabilityBadgeProps {
  score: number;
  machineLabel: string;
  fileName?: string;
  reportUrl?: string;
}

export function MachinabilityBadge({
  score,
  machineLabel,
  fileName,
  reportUrl,
}: MachinabilityBadgeProps) {
  const [status, setStatus] = useState<string | null>(null);
  const tier = useMemo(() => getMachinabilityTier(score), [score]);

  const svg = useMemo(
    () =>
      buildMachinabilityFlexSvg({
        score: tier.score,
        tierLabel: tier.label,
        machineLabel,
        fileName,
      }),
    [tier, machineLabel, fileName],
  );

  const tweet = useMemo(
    () =>
      buildScoreFlexTweet({
        score: tier.score,
        tierLabel: tier.label,
        machineLabel,
        reportUrl,
      }),
    [tier, machineLabel, reportUrl],
  );

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 4000);
  }, []);

  const handlePostToX = useCallback(async () => {
    const png = await svgToPngBlob(svg);
    const mode = await shareImageToX(png, tweet, "steprs-machinability.png");
    if (mode === "shared") flash("Shared to X");
    else if (mode === "clipboard") flash("Image copied — paste into your post");
    else flash("Card downloaded — attach to your post");
  }, [svg, tweet, flash]);

  const handleDownload = useCallback(async () => {
    const png = await svgToPngBlob(svg);
    await downloadBlob(png, "steprs-machinability.png");
    flash("PNG saved");
  }, [svg, flash]);

  return (
    <section
      className={cn("machinability-badge", `machinability-badge--${tier.slug}`)}
      data-testid="machinability-badge"
    >
      <div className="machinability-badge__score">
        <span className="machinability-badge__value">{tier.score}%</span>
        <span className="machinability-badge__label">{tier.label}</span>
      </div>

      <details className="machinability-badge__card">
        <summary>Share machinability card</summary>
        <img
          className="machinability-badge__preview"
          src={svgDataUrl(svg)}
          alt={`Machinability ${tier.score}% ${tier.label}`}
          width={600}
          height={315}
        />
        <div className="machinability-badge__actions">
          <Button type="button" variant="glow" size="sm" onClick={handlePostToX}>
            Post to X
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
            Download card
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => openXIntent(tweet)}>
            Tweet text only
          </Button>
        </div>
      </details>

      {status && <p className="machinability-badge__status">{status}</p>}
    </section>
  );
}
