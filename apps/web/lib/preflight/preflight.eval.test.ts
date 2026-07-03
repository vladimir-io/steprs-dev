/**
 * Rule-engine regression matrix (Phase 2 of the eval strategy).
 *
 * Each case in preflight-rules.eval.json pins the worst status the engine
 * must produce for a rule given a real fixture ParseResult + shop setup.
 * A change in hole/pocket/envelope extraction or rule thresholds that flips
 * a pinned outcome fails CI.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import type { ParseResult } from "@steprs/ts-types";

import matrix from "./preflight-rules.eval.json";
import {
  runPreflight,
  type CheckStatus,
  type PreflightConfig,
  type RuleId,
} from "./engine";

const FIXTURES_DIR = join(process.cwd(), "data", "api", "v1", "fixtures");

const SEVERITY: Record<CheckStatus, number> = {
  pass: 0,
  info: 1,
  warn: 2,
  fail: 3,
};

function loadFixture(id: string): ParseResult {
  const raw = JSON.parse(
    readFileSync(join(FIXTURES_DIR, `${id}.json`), "utf8"),
  ) as { parse: ParseResult };
  return raw.parse;
}

function worstStatus(
  result: ParseResult,
  config: PreflightConfig,
  rule: RuleId,
): CheckStatus | null {
  const statuses = runPreflight(result, config)
    .checks.filter((c) => c.rule === rule)
    .map((c) => c.status);
  if (statuses.length === 0) return null;
  return statuses.reduce((worst, s) =>
    SEVERITY[s] > SEVERITY[worst] ? s : worst,
  );
}

describe("preflight-rules.eval.json regression matrix", () => {
  for (const testCase of matrix.cases) {
    it(testCase.name, () => {
      const result = loadFixture(testCase.fixture);
      const config = testCase.config as PreflightConfig;
      for (const [rule, expected] of Object.entries(testCase.expect)) {
        const actual = worstStatus(result, config, rule as RuleId);
        assert.equal(
          actual,
          expected,
          `${testCase.fixture} / ${rule}: expected ${expected}, got ${actual}`,
        );
      }
    });
  }
});
