import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMachinabilityTier } from "./machinability-tier";

describe("machinability-tier", () => {
  it("labels clean cuts at 90+", () => {
    assert.equal(getMachinabilityTier(98).label, "Clean Cut");
  });

  it("labels nightmare fuel below 25", () => {
    assert.equal(getMachinabilityTier(32).label, "Headache");
    assert.equal(getMachinabilityTier(18).label, "Nightmare Fuel");
  });
});
