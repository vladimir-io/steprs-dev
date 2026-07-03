import type { PreflightCheck, RuleId } from "./engine";

export const CRASH_RULE_PRIORITY: RuleId[] = [
  "pocket-reach",
  "z-stack",
  "envelope-fit",
  "hole-tooling",
  "five-axis",
  "sharp-corners",
  "vise-fit",
  "flat-bottom-holes",
  "undercuts",
];

const CARD_W = 1200;
const CARD_H = 630;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Highest-priority `fail` check for the crash-risk social card. */
export function pickCrashRiskCheck(
  checks: PreflightCheck[],
): PreflightCheck | null {
  const fails = checks.filter((c) => c.status === "fail");
  if (!fails.length) return null;

  for (const rule of CRASH_RULE_PRIORITY) {
    const hit = fails.find((c) => c.rule === rule);
    if (hit) return hit;
  }
  return fails[0] ?? null;
}

export interface CrashRiskCardInput {
  check: PreflightCheck;
  machineLabel: string;
  machinabilityScore: number;
  fileName?: string;
}

/** Dark-mode dashboard SVG for X / screenshot sharing. */
export function buildCrashRiskSvg(input: CrashRiskCardInput): string {
  const title = escapeXml(truncate(input.check.title.toUpperCase(), 72));
  const detail = escapeXml(truncate(input.check.detail, 140));
  const machine = escapeXml(input.machineLabel);
  const file = escapeXml(truncate(input.fileName ?? "STEP diagnostic", 48));
  const score = input.machinabilityScore;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0d12"/>
      <stop offset="100%" stop-color="#141820"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ff3b30"/>
      <stop offset="100%" stop-color="#ff6b4a"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="48" y="48" width="1104" height="534" rx="24" fill="#11151c" stroke="#2a3140" stroke-width="2"/>
  <rect x="48" y="48" width="1104" height="6" rx="3" fill="url(#accent)" filter="url(#glow)"/>
  <text x="88" y="118" fill="#ff5a4f" font-family="ui-sans-serif,system-ui,sans-serif" font-size="28" font-weight="700" letter-spacing="0.12em">CRASH RISK DETECTED</text>
  <text x="88" y="210" fill="#f4f6fb" font-family="ui-sans-serif,system-ui,sans-serif" font-size="44" font-weight="700">${title}</text>
  <text x="88" y="280" fill="#9aa3b5" font-family="ui-sans-serif,system-ui,sans-serif" font-size="26">${detail}</text>
  <rect x="88" y="330" width="1024" height="2" fill="#252b38"/>
  <text x="88" y="390" fill="#6b7589" font-family="ui-sans-serif,system-ui,sans-serif" font-size="22">Machine</text>
  <text x="88" y="430" fill="#e8ecf4" font-family="ui-sans-serif,system-ui,sans-serif" font-size="30" font-weight="600">${machine}</text>
  <text x="88" y="490" fill="#6b7589" font-family="ui-sans-serif,system-ui,sans-serif" font-size="22">File · Machinability</text>
  <text x="88" y="530" fill="#e8ecf4" font-family="ui-sans-serif,system-ui,sans-serif" font-size="28">${file} · ${score}%</text>
  <text x="1112" y="560" text-anchor="end" fill="#4a5568" font-family="ui-sans-serif,system-ui,sans-serif" font-size="20">steprs.dev · local WASM pre-flight</text>
</svg>`;
}

export function buildMachinabilityFlexSvg(input: {
  score: number;
  tierLabel: string;
  machineLabel: string;
  fileName?: string;
}): string {
  const tier = escapeXml(input.tierLabel.toUpperCase());
  const machine = escapeXml(input.machineLabel);
  const file = escapeXml(truncate(input.fileName ?? "STEP model", 48));
  const score = input.score;
  const accent =
    score >= 75 ? "#34d399" : score >= 50 ? "#fbbf24" : score >= 25 ? "#fb923c" : "#f87171";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0d12"/>
      <stop offset="100%" stop-color="#141820"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="48" y="48" width="1104" height="534" rx="24" fill="#11151c" stroke="#2a3140" stroke-width="2"/>
  <text x="88" y="118" fill="#7c869a" font-family="ui-sans-serif,system-ui,sans-serif" font-size="26" font-weight="600" letter-spacing="0.1em">MACHINABILITY INDEX</text>
  <text x="88" y="280" fill="${accent}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="120" font-weight="700">${score}%</text>
  <text x="88" y="340" fill="#f4f6fb" font-family="ui-sans-serif,system-ui,sans-serif" font-size="40" font-weight="600">${tier}</text>
  <text x="88" y="420" fill="#9aa3b5" font-family="ui-sans-serif,system-ui,sans-serif" font-size="26">${file} on ${machine}</text>
  <text x="1112" y="560" text-anchor="end" fill="#4a5568" font-family="ui-sans-serif,system-ui,sans-serif" font-size="20">steprs.dev · rate my setup</text>
</svg>`;
}

export async function svgToPngBlob(
  svg: string,
  width = CARD_W,
  height = CARD_H,
): Promise<Blob> {
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );

  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("png encode failed");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("svg render failed"));
    img.src = url;
  });
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
