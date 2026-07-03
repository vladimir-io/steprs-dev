import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compareGcodeToModel,
  scanMaxPlungeDepthMm,
} from "./gcode-scan";

describe("gcode-scan", () => {
  it("finds deepest Z plunge", () => {
    const gcode = `
G0 X0 Y0 Z5
G1 Z-12.5 F100
G1 X10 Y10 Z-8
G1 Z-15.25
`;
    assert.equal(scanMaxPlungeDepthMm(gcode), 15.25);
  });

  it("ignores comments", () => {
    const gcode = "; Z-99\nG1 Z-4";
    assert.equal(scanMaxPlungeDepthMm(gcode), 4);
  });

  it("flags deeper plunge than model", () => {
    const check = compareGcodeToModel("G1 Z-20", 10);
    assert.equal(check?.status, "fail");
    assert.match(check?.detail ?? "", /20\.00 mm/);
  });

  it("passes when plunge within model depth", () => {
    const check = compareGcodeToModel("G1 Z-9.5", 10);
    assert.equal(check?.status, "pass");
  });
});
