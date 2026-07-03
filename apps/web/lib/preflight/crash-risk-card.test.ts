import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCrashRiskSvg,
  pickCrashRiskCheck,
} from "./crash-risk-card";
import type { PreflightCheck } from "./engine";

const failPocket: PreflightCheck = {
  rule: "pocket-reach",
  status: "fail",
  title: '1/4" flute length (19 mm) < pocket depth (25 mm)',
  detail: "Shank will rub before floor is reached.",
};

const failZ: PreflightCheck = {
  rule: "z-stack",
  status: "fail",
  title: "Z-stack interference",
  detail: "Vise + part + stickout exceed clearance.",
};

describe("crash-risk-card", () => {
  it("prioritizes pocket-reach over z-stack", () => {
    const pick = pickCrashRiskCheck([failZ, failPocket]);
    assert.equal(pick?.rule, "pocket-reach");
  });

  it("builds escaped SVG payload", () => {
    const svg = buildCrashRiskSvg({
      check: failPocket,
      machineLabel: 'Shapeoko HDM',
      machinabilityScore: 41,
      fileName: "bracket.step",
    });
    assert.match(svg, /CRASH RISK DETECTED/);
    assert.match(svg, /Shapeoko HDM/);
    assert.doesNotMatch(svg, /<pocket/);
  });
});
