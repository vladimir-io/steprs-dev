#!/usr/bin/env node
/**
 * Generate icon + OG image (hex wordmark — no logo mark).
 * Run: node scripts/generate-brand-assets.mjs && node scripts/generate-favicons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

const sharpPath = path.join(
  __dirname,
  "../../../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js",
);
const sharp = (await import(pathToFileURL(sharpPath).href)).default;

/** Machinist DRO favicon — dark panel, amber 0x readout */
function iconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#141310"/>
  <rect x="48" y="48" width="416" height="416" rx="16" fill="#0f0e0c" stroke="#c45c00" stroke-width="10"/>
  <rect x="88" y="168" width="336" height="176" rx="6" fill="#1a1814" stroke="#3d3a34" stroke-width="4"/>
  <line x1="88" y1="200" x2="424" y2="200" stroke="#2a2824" stroke-width="2"/>
  <text x="256" y="292" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="108" font-weight="700" fill="#c45c00" letter-spacing="-4">0x</text>
  <circle cx="108" cy="108" r="6" fill="#166534"/>
  <rect x="380" y="96" width="48" height="8" rx="2" fill="#3d3a34"/>
  <rect x="380" y="112" width="32" height="8" rx="2" fill="#3d3a34"/>
</svg>`;
}

function ogSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ece8df"/>
      <stop offset="100%" stop-color="#e0dbd0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="88" y="140" width="320" height="120" rx="8" fill="#141310" stroke="#c45c00" stroke-width="4"/>
  <rect x="108" y="188" width="280" height="52" rx="4" fill="#1a1814"/>
  <text x="248" y="228" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="36" font-weight="700" fill="#c45c00">0x737465707273</text>
  <text x="480" y="210" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="88" font-weight="700" fill="#121110" letter-spacing="-3">STEP</text>
  <text x="720" y="210" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="88" font-weight="500" fill="#78736a">rs</text>
  <text x="820" y="210" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="40" font-weight="400" fill="#78736a">.dev</text>
  <text x="480" y="310" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="400" fill="#121110" opacity="0.72">Check STEP files before CAM</text>
  <text x="480" y="360" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="400" fill="#121110" opacity="0.5">Client-side · ISO 10303-21 · No upload</text>
</svg>`;
}

async function writeSvgPng(svg, outPath, width, height) {
  await sharp(Buffer.from(svg))
    .resize(width, height)
    .png()
    .toFile(outPath);
  console.log("wrote", path.relative(publicDir, outPath));
}

await writeSvgPng(iconSvg(), path.join(publicDir, "icon.png"), 512, 512);
await writeSvgPng(ogSvg(), path.join(publicDir, "og-image.png"), 1200, 630);
