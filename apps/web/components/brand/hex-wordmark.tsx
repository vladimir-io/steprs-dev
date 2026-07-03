"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { brandLoaderSizes, type BrandLoaderSize } from "@/lib/site-brand";
import { cn } from "@/lib/utils";

const WORD = "steprs";
const HEX = "0123456789ABCDEF";

export type HexWordmarkVariant = "header" | "loader";
export type HexWordmarkAnimate = boolean | "once";

export interface HexWordmarkProps {
  variant?: HexWordmarkVariant;
  /** When true, loop scramble→resolve while loading. "once" runs on mount then holds. */
  animate?: HexWordmarkAnimate;
  showDomain?: boolean;
  size?: BrandLoaderSize | number;
  className?: string;
}

function randomHexPair() {
  return HEX[Math.floor(Math.random() * 16)] + HEX[Math.floor(Math.random() * 16)];
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function HexWordmark({
  variant = "loader",
  animate = false,
  showDomain = false,
  size = "md",
  className,
}: HexWordmarkProps) {
  const px = typeof size === "number" ? size : brandLoaderSizes[size];
  const [cells, setCells] = useState<string[]>(() => WORD.split(""));
  const [resolved, setResolved] = useState(WORD.length);

  const lockup = variant === "header" && resolved >= WORD.length;

  useEffect(() => {
    if (!animate) {
      setCells(WORD.split(""));
      setResolved(WORD.length);
      return;
    }

    if (prefersReducedMotion()) {
      setCells(WORD.split(""));
      setResolved(WORD.length);
      return;
    }

    let scrambleId = 0;
    let resolveId = 0;
    let resolveIndex = 0;
    let cycleTimeout = 0;
    let cancelled = false;

    const runCycle = () => {
      if (cancelled) return;
      resolveIndex = 0;
      setResolved(0);
      setCells(Array.from({ length: WORD.length }, randomHexPair));

      scrambleId = window.setInterval(() => {
        setCells((prev) =>
          prev.map((cell, index) => (index < resolveIndex ? WORD[index]! : randomHexPair())),
        );
      }, 65);

      window.setTimeout(() => {
        window.clearInterval(scrambleId);
        resolveId = window.setInterval(() => {
          if (resolveIndex >= WORD.length) {
            window.clearInterval(resolveId);
            setResolved(WORD.length);
            if (animate === true) {
              cycleTimeout = window.setTimeout(runCycle, 1400);
            }
            return;
          }
          setCells((prev) => {
            const next = [...prev];
            next[resolveIndex] = WORD[resolveIndex]!;
            return next;
          });
          resolveIndex += 1;
          setResolved(resolveIndex);
        }, 110);
      }, 750);
    };

    runCycle();

    return () => {
      cancelled = true;
      window.clearInterval(scrambleId);
      window.clearInterval(resolveId);
      window.clearTimeout(cycleTimeout);
    };
  }, [animate]);

  const scrambling = resolved < WORD.length;
  const scale = useMemo(() => {
    if (typeof size === "number") return px / brandLoaderSizes.md;
    return { xs: 0.55, sm: 0.72, md: 1, lg: 1.35 }[size];
  }, [px, size]);

  return (
    <span
      className={cn(
        "hex-wordmark",
        `hex-wordmark--${variant}`,
        typeof size === "string" && `hex-wordmark--${size}`,
        scrambling && "hex-wordmark--scrambling",
        lockup && "hex-wordmark--lockup",
        className,
      )}
      style={{ "--hex-wordmark-scale": scale } as CSSProperties}
      aria-hidden={variant === "header"}
    >
      <span className="hex-wordmark__prefix">0x</span>
      <span className="hex-wordmark__body">
        {lockup ? (
          <>
            <span className="hex-wordmark__core">STEP</span>
            <span className="hex-wordmark__tail">rs</span>
          </>
        ) : (
          cells.map((cell, index) => (
            <span
              key={`${index}-${cell}`}
              className={cn(
                "hex-wordmark__cell",
                index < resolved && "hex-wordmark__cell--resolved",
              )}
            >
              {cell}
            </span>
          ))
        )}
      </span>
      {showDomain ? <span className="hex-wordmark__domain">.dev</span> : null}
    </span>
  );
}

/** @deprecated Use HexWordmark */
export function BrandLoaderMark({
  size = "md",
  active = true,
  className,
}: {
  size?: BrandLoaderSize | number;
  active?: boolean;
  className?: string;
}) {
  return (
    <HexWordmark
      variant="loader"
      animate={active}
      size={size}
      className={className}
    />
  );
}
