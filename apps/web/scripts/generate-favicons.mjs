/**
 * Regenerate favicon assets from public/icon.png.
 * Run from repo root: pnpm --filter @steprs/web favicons
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");
const src = path.join(publicDir, "icon.png");
const bg = { r: 20, g: 19, b: 16, alpha: 1 };

const sharpPath = path.join(
  __dirname,
  "../../../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js",
);
const sharp = (await import(pathToFileURL(sharpPath).href)).default;

async function squareIcon(size, filename) {
  const out = path.join(publicDir, filename);
  const meta = await sharp(src).metadata();
  const scale = Math.min(size / meta.width, size / meta.height) * 0.88;
  const w = Math.round(meta.width * scale);
  const h = Math.round(meta.height * scale);
  const left = Math.round((size - w) / 2);
  const top = Math.round((size - h) / 2);

  await sharp(src)
    .resize(w, h, { fit: "inside" })
    .extend({
      top,
      bottom: size - h - top,
      left,
      right: size - w - left,
      background: bg,
    })
    .png()
    .toFile(out);
  console.log("wrote", filename);
}

function pngToIco(pngPaths, outPath) {
  const pngs = pngPaths.map((p) => fs.readFileSync(path.join(publicDir, p)));
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  let offset = 6 + count * 16;

  for (const png of pngs) {
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    const entry = Buffer.alloc(16);
    entry[0] = width >= 256 ? 0 : width;
    entry[1] = height >= 256 ? 0 : height;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  fs.writeFileSync(outPath, Buffer.concat([header, ...entries, ...pngs]));
  console.log("wrote favicon.ico");
}

await squareIcon(32, "favicon-32x32.png");
await squareIcon(48, "favicon-48x48.png");
await squareIcon(96, "favicon-96x96.png");
await squareIcon(180, "apple-touch-icon.png");
await squareIcon(192, "favicon-192x192.png");
fs.copyFileSync(
  path.join(publicDir, "favicon-48x48.png"),
  path.join(publicDir, "favicon.png"),
);
pngToIco(
  ["favicon-32x32.png", "favicon-48x48.png", "favicon-96x96.png"],
  path.join(publicDir, "favicon.ico"),
);
