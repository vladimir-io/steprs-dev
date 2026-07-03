import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_PARSE_FILE_BYTES,
  PREFLIGHT_PROBE_BYTES,
  preflightStepBytes,
  validateFileSize,
  looksLikeStepContent,
} from "./file-guardrails";

const MINIMAL_STEP = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION((''),'2;1');
FILE_NAME('part','',(''),(''),'','','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));
ENDSEC;
DATA;
#1=CARTESIAN_POINT('',(0.,0.,0.));
ENDSEC;
END-ISO-10303-21;
`;

describe("preflightStepBytes", () => {
  it("accepts valid ISO-10303-21 header with DATA", () => {
    const bytes = new TextEncoder().encode(MINIMAL_STEP).buffer;
    assert.equal(preflightStepBytes(bytes).ok, true);
  });

  it("rejects non-ISO content", () => {
    const bytes = new TextEncoder().encode("solid cube\n facet normal 0 0 1\n").buffer;
    const result = preflightStepBytes(bytes);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /STL/i);
  });

  it("rejects missing HEADER", () => {
    const bytes = new TextEncoder().encode("ISO-10303-21;\nDATA;\n").buffer;
    const result = preflightStepBytes(bytes);
    assert.equal(result.ok, false);
  });

  it("probes only the first 500 bytes", () => {
    assert.equal(PREFLIGHT_PROBE_BYTES, 500);
  });
});

describe("looksLikeStepContent", () => {
  it("requires DATA section in deep probe", () => {
    const headerOnly = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));
ENDSEC;
`;
    const bytes = new TextEncoder().encode(headerOnly).buffer;
    assert.equal(looksLikeStepContent(bytes), false);
    assert.equal(looksLikeStepContent(new TextEncoder().encode(MINIMAL_STEP).buffer), true);
  });
});

describe("validateFileSize", () => {
  it("enforces 50 MB clamp", () => {
    const over = new File([new Uint8Array(1)], "big.step", {
      type: "application/step",
    });
    Object.defineProperty(over, "size", { value: MAX_PARSE_FILE_BYTES + 1 });
    const result = validateFileSize(over);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /50/);
  });
});
