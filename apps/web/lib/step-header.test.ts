import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inspectStepHeader } from "./step-header";

function encodeAscii(text: string): ArrayBuffer {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i);
  }
  return bytes.buffer;
}

describe("inspectStepHeader assembly detection", () => {
  it("flags assembly markers in DATA scan window", () => {
    const step = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION((''),(''));
FILE_NAME('assy','2026-01-01',(''),(''),'');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));
ENDSEC;
DATA;
#10=NEXT_ASSEMBLY_USAGE_OCCURRENCE('','','',#11,#12,$);
ENDSEC;
END-ISO-10303-21;`;
    const report = inspectStepHeader(encodeAscii(step));
    assert.equal(report.assembly.isAssembly, true);
    assert.ok(report.assembly.indicators.includes("NEXT_ASSEMBLY_USAGE_OCCURRENCE"));
  });

  it("reports single-part when no assembly markers appear", () => {
    const step = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));
ENDSEC;
DATA;
#1=CARTESIAN_POINT('',(0.0,0.0,0.0));
ENDSEC;
END-ISO-10303-21;`;
    const report = inspectStepHeader(encodeAscii(step));
    assert.equal(report.assembly.isAssembly, false);
  });
});
