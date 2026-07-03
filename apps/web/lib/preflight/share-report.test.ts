import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decodeSharePayload,
  encodeSharePayload,
  type SharedReportPayload,
} from "./share-report";

const sample: SharedReportPayload = {
  v: 1,
  machineId: "shapeoko-4-standard",
  workholdingId: "fixture-plate-clamps",
  materialId: "aluminum-6061",
  toolIds: ["em-flat-6.35"],
  stockAllowanceMm: 3.175,
  envelope: { x: 120, y: 80, z: 25 },
  machinabilityScore: 72,
  checks: [
    {
      rule: "pocket-reach",
      status: "fail",
      title: "Pocket too deep",
      detail: "Needs longer LOC.",
    },
  ],
  deepestPocketMm: 18,
  createdAt: 1_700_000_000_000,
};

describe("share-report", () => {
  it("round-trips payload through lz-string compression", () => {
    const encoded = encodeSharePayload(sample);
    assert.ok(encoded.length > 0);
    const decoded = decodeSharePayload(encoded);
    assert.deepEqual(decoded, sample);
  });

  it("rejects invalid payloads", () => {
    assert.equal(decodeSharePayload(""), null);
    assert.equal(decodeSharePayload("not-valid"), null);
  });
});
