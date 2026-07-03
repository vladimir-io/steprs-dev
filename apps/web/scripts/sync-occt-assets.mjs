#!/usr/bin/env node
/** Copy occt-import-js dist assets into public/occt for worker importScripts + Vercel static hosting. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(__dirname, "../node_modules/occt-import-js/dist");
const dest = path.join(__dirname, "../public/occt");

const FILES = [
  "occt-import-js.js",
  "occt-import-js.wasm",
  "occt-import-js-worker.js",
];

if (!fs.existsSync(pkgRoot)) {
  console.warn("[sync-occt] occt-import-js not installed — skip");
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });
for (const file of FILES) {
  const src = path.join(pkgRoot, file);
  if (!fs.existsSync(src)) {
    console.error(`[sync-occt] missing ${src}`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(dest, file));
}
console.log(`[sync-occt] synced ${FILES.length} files → public/occt/`);
