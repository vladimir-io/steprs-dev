#!/usr/bin/env node
/** Print handoff stats for bundled fixtures (validates API snapshots). */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ids = ["hole-plate", "mounting-plate", "machined-bracket"];

console.log("steprs fixture handoff audit\n");

for (const id of ids) {
  const path = join(root, "data/api/v1/fixtures", `${id}.json`);
  const snap = JSON.parse(readFileSync(path, "utf8"));
  const aag = snap.parse.aag;
  const q = snap.parse.quoting;
  const graphNodes = aag.graph?.length ?? 0;
  const concave = aag.concave_edge_count ?? 0;

  console.log(`## ${id} (${snap.label})`);
  console.log(`  holes: ${q.holes.length}  pockets: ${q.pockets.length}  slots: ${q.slots.length}`);
  console.log(
    `  AAG: ${aag.face_count} faces, ${aag.manifold_edge_count} manifold, ${concave} concave`,
  );
  console.log(`  graph nodes: ${graphNodes}`);
  console.log("");
}
