import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decodeCribPayload,
  encodeCribPayload,
  type SharedCribPayload,
} from "./share-crib";

const sample: SharedCribPayload = {
  v: 1,
  machineId: "tormach-440",
  workholdingId: "kurt-dx4",
  materialId: "aluminum-6061",
  toolIds: ["em-flat-6.35", "drill-6.35"],
  stockAllowanceMm: 3.175,
  label: "Tormach 440",
};

describe("share-crib", () => {
  it("round-trips crib payload", () => {
    const encoded = encodeCribPayload(sample);
    assert.deepEqual(decodeCribPayload(encoded), sample);
  });
});
