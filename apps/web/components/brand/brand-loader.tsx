"use client";

import { brandLoaderSizes, type BrandLoaderSize } from "@/lib/site-brand";
import { cn } from "@/lib/utils";

import { HexWordmark } from "./hex-wordmark";

export interface BrandLoaderProps {
  size?: BrandLoaderSize;
  label?: string;
  className?: string;
}

export function BrandLoader({
  size = "md",
  label,
  className,
}: BrandLoaderProps) {
  const statusLabel = label ?? "Loading";

  return (
    <div
      className={cn("brand-loader", `brand-loader--${size}`, className)}
      role="status"
      aria-live="polite"
      aria-label={statusLabel}
    >
      <HexWordmark variant="loader" animate size={size} showDomain={size === "lg"} />
      {label ? <p className="brand-loader__label">{label}</p> : null}
    </div>
  );
}

export { brandLoaderSizes, type BrandLoaderSize };
