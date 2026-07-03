/**
 * Smoke-test STEP parse pipeline against local files (same WASM as the web worker).
 * Usage: npx tsx scripts/validate-downloads.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DOWNLOADS = "/Users/vladimirgutierrez/Downloads";
const WASM_JS = pathToFileURL(
  join(process.cwd(), "public/wasm/steprs_core.js"),
).href;
const WASM_BIN = join(process.cwd(), "public/wasm/steprs_core_bg.wasm");

async function main() {
  const wasm = await import(/* webpackIgnore: true */ WASM_JS);
  await wasm.default(readFileSync(WASM_BIN));
  const { StepParser } = wasm as {
    StepParser: new () => {
      parseWithOptions: (b: Uint8Array, mesh: boolean, labels: boolean) => string;
      free?: () => void;
    };
  };

  const files = readdirSync(DOWNLOADS)
    .filter((f) => f.toLowerCase().endsWith(".step"))
    .sort();

  let passed = 0;
  let failed = 0;

  for (const name of files) {
    const bytes = readFileSync(join(DOWNLOADS, name));
    const parser = new StepParser();
    try {
      const json = parser.parseWithOptions(bytes, true, false);
      const result = JSON.parse(json) as {
        stats?: { entity_count?: number };
        mesh?: { triangle_count?: number; mesh_engine?: string };
      };
      const tris = result.mesh?.triangle_count ?? 0;
      const ents = result.stats?.entity_count ?? 0;
      const engine = result.mesh?.mesh_engine ?? "?";
      console.log(
        `OK  ${name.padEnd(52)} ${String(ents).padStart(6)} ents  ${String(tris).padStart(6)} tris  ${engine}`,
      );
      passed += 1;
    } catch (err) {
      console.error(`FAIL ${name}:`, err instanceof Error ? err.message : err);
      failed += 1;
    } finally {
      parser.free?.();
    }
  }

  console.log(`\nWASM web bundle: ${passed} passed · ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
