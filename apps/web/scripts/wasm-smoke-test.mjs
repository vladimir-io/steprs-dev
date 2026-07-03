#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");
const coreRoot = join(webRoot, "../../crates/steprs-core");
const wasmDir = join(webRoot, "public/wasm");
const snapDir = join(coreRoot, "tests/fixtures/golden/snapshots");
const manifest = JSON.parse(
  readFileSync(join(coreRoot, "tests/fixtures/golden/manifest.json"), "utf8"),
);

function resolveFixturePath(rel) {
  if (rel.startsWith("../../")) {
    return join(coreRoot, rel);
  }
  return join(coreRoot, rel);
}

function holesDigest(holes) {
  return createHash("sha256")
    .update(JSON.stringify(holes))
    .digest("hex")
    .slice(0, 12);
}

async function main() {
  const wasmUrl = pathToFileURL(join(wasmDir, "steprs_core.js")).href;
  const { default: init, StepParser } = await import(wasmUrl);
  const wasmBytes = readFileSync(join(wasmDir, "steprs_core_bg.wasm"));
  await init({ module_or_path: wasmBytes });

  const parser = new StepParser();
  let failed = false;
  let ran = 0;

  for (const fixture of manifest.fixtures) {
    if (fixture.tier !== "strict") continue;
    const snapPath = join(snapDir, `${fixture.id}.holes.json`);
    if (!existsSync(snapPath)) continue;

    const path = resolveFixturePath(fixture.path);
    const bytes = readFileSync(path);
    const json = parser.parseQuotingOnly(bytes);
    const result = JSON.parse(json);
    const live = result.quoting.holes;
    const expected = JSON.parse(readFileSync(snapPath, "utf8"));

    ran += 1;
    try {
      assert.deepStrictEqual(live, expected);
    } catch {
      console.error(
        `WASM smoke FAIL ${fixture.id}: quoting.holes drift (live ${holesDigest(live)} != snapshot ${holesDigest(expected)})`,
      );
      failed = true;
      continue;
    }
    console.log(`WASM smoke OK ${fixture.id} (${live.length} holes)`);
  }

  parser.free();
  if (ran === 0) {
    console.error("WASM smoke: no strict fixtures with snapshots");
    process.exit(1);
  }
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
