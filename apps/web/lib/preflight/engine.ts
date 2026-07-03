/**
 * CAM Pre-Flight rule engine.
 *
 * Translates the Rust ParseResult into explicit manufacturing risks against a
 * selected machine, workholding, and tool crib. Deterministic and fully
 * client-side; every rule is locked by preflight-rules.eval.json in CI.
 */

import type { ParseResult, MachiningHole, DetectedPocket } from "@steprs/ts-types";

import { getMachine, type MachineProfile } from "./machines";
import {
  getTools,
  DRILL_MATCH_TOLERANCE_MM,
  type ToolProfile,
} from "./tools";
import { getWorkholding, type WorkholdingProfile } from "./workholding";
import { getMaterial, recommendFeeds, type MaterialId } from "./feeds";

export type CheckStatus = "pass" | "warn" | "fail" | "info";

export type RuleId =
  | "envelope-fit"
  | "vise-fit"
  | "z-stack"
  | "hole-tooling"
  | "pocket-reach"
  | "flat-bottom-holes"
  | "sharp-corners"
  | "undercuts"
  | "five-axis"
  | "machinability-score"
  | "feeds-speeds";

export interface PreflightCheck {
  rule: RuleId;
  status: CheckStatus;
  title: string;
  detail: string;
}

export interface PreflightConfig {
  machineId: string;
  workholdingId: string;
  toolIds: string[];
  materialId: MaterialId;
}

export interface PreflightReport {
  checks: PreflightCheck[];
  /** 0–100; higher = easier on a 3-axis machine. */
  machinabilityScore: number;
  counts: { pass: number; warn: number; fail: number; info: number };
}

/** Extra Z headroom demanded before a pass (rapid-move safety). */
const Z_SAFETY_MM = 10;
/** Collet nut / holder body allowance below the spindle nose. */
const HOLDER_ALLOWANCE_MM = 25;
/** Endmill can helical-bore a hole when its diameter ≤ this fraction of the bore. */
const HELICAL_MAX_DIA_RATIO = 0.85;

const fmt = (n: number, d = 1) => n.toFixed(d).replace(/\.0$/, "");

export function runPreflight(
  result: ParseResult,
  config: PreflightConfig,
): PreflightReport {
  const machine = getMachine(config.machineId);
  const workholding = getWorkholding(config.workholdingId);
  const tools = getTools(config.toolIds);
  const checks: PreflightCheck[] = [];

  if (!machine || !workholding) {
    return finishReport(checks, 0);
  }

  const env = result.quoting.part_envelope_mm.dimensions;
  // Lay the part flat: two largest dims in XY, smallest up.
  const sorted = [env.x, env.y, env.z].sort((a, b) => b - a) as [
    number,
    number,
    number,
  ];
  const [partL, partW, partH] = sorted;

  checks.push(checkEnvelopeFit(machine, partL, partW, partH));
  checks.push(checkViseFit(workholding, partL, partW));
  checks.push(checkZStack(machine, workholding, partH, tools));
  checks.push(...checkHoleTooling(result.quoting.holes, tools));
  checks.push(...checkPocketReach(result.quoting.pockets, tools));
  checks.push(checkFlatBottomHoles(result.quoting.holes));
  checks.push(checkSharpCorners(result, tools));
  checks.push(checkUndercuts(result));
  checks.push(checkFiveAxis(result, machine));

  const score = machinabilityScore(result, checks);
  checks.push({
    rule: "machinability-score",
    status: score >= 70 ? "pass" : score >= 40 ? "warn" : "fail",
    title: `Machinability score: ${score}/100`,
    detail:
      score >= 70
        ? "Straightforward 3-axis work with your setup."
        : score >= 40
          ? "Machinable, but review the warnings before CAM."
          : "Significant obstacles for a 3-axis setup — expect extra setups or different tooling.",
  });

  checks.push(...feedsChecks(tools, config.materialId, machine));

  return finishReport(checks, score);
}

function finishReport(
  checks: PreflightCheck[],
  machinability: number,
): PreflightReport {
  const counts = { pass: 0, warn: 0, fail: 0, info: 0 };
  for (const c of checks) counts[c.status] += 1;
  return { checks, machinabilityScore: machinability, counts };
}

function checkEnvelopeFit(
  machine: MachineProfile,
  partL: number,
  partW: number,
  partH: number,
): PreflightCheck {
  const [travelL, travelW] = [machine.travelMm.x, machine.travelMm.y].sort(
    (a, b) => b - a,
  ) as [number, number];
  const xyFits = partL <= travelL && partW <= travelW;
  const zFits = partH <= machine.travelMm.z;

  if (xyFits && zFits) {
    return {
      rule: "envelope-fit",
      status: "pass",
      title: "Part fits machine travel",
      detail: `${fmt(partL)} × ${fmt(partW)} × ${fmt(partH)} mm inside ${machine.label} travels (${machine.travelMm.x} × ${machine.travelMm.y} × ${machine.travelMm.z} mm).`,
    };
  }
  return {
    rule: "envelope-fit",
    status: "fail",
    title: xyFits ? "Part too tall for Z travel" : "Part exceeds XY travel",
    detail: `${fmt(partL)} × ${fmt(partW)} × ${fmt(partH)} mm vs ${machine.label} travels ${machine.travelMm.x} × ${machine.travelMm.y} × ${machine.travelMm.z} mm. Consider tiling, a flip, or a bigger machine.`,
  };
}

function checkViseFit(
  workholding: WorkholdingProfile,
  partL: number,
  partW: number,
): PreflightCheck {
  // Grip across the narrower dimension.
  if (partW > workholding.jawOpeningMm) {
    return {
      rule: "vise-fit",
      status: "fail",
      title: "Part wider than jaw opening",
      detail: `Narrow side is ${fmt(partW)} mm but ${workholding.label} opens ${fmt(workholding.jawOpeningMm)} mm max. Use a fixture plate, clamps, or soft-jaw extensions.`,
    };
  }
  if (partL > workholding.jawWidthMm * 1.5) {
    return {
      rule: "vise-fit",
      status: "warn",
      title: "Long overhang past the jaws",
      detail: `Part length ${fmt(partL)} mm overhangs ${workholding.label} jaws (${fmt(workholding.jawWidthMm)} mm wide) by more than 50%. Support the ends or expect chatter.`,
    };
  }
  return {
    rule: "vise-fit",
    status: "pass",
    title: "Workholding grips the part",
    detail: `${fmt(partW)} mm grip inside ${workholding.label} ${fmt(workholding.jawOpeningMm)} mm opening.`,
  };
}

function checkZStack(
  machine: MachineProfile,
  workholding: WorkholdingProfile,
  partH: number,
  tools: ToolProfile[],
): PreflightCheck {
  const maxStickout = tools.length
    ? Math.max(...tools.map((t) => t.defaultStickoutMm))
    : 0;
  const stack = workholding.heightMm + partH + maxStickout + HOLDER_ALLOWANCE_MM;
  const clearance = machine.zClearanceMm;
  const remaining = clearance - stack;
  const breakdown = `vise ${fmt(workholding.heightMm)} + part ${fmt(partH)} + stickout ${fmt(maxStickout)} + holder ${HOLDER_ALLOWANCE_MM} = ${fmt(stack)} mm vs ${fmt(clearance)} mm clearance`;

  if (remaining < 0) {
    return {
      rule: "z-stack",
      status: "fail",
      title: "Z-stack exceeds machine clearance",
      detail: `${breakdown}. The spindle cannot rapid over the part. Use lower workholding or shorter tools.`,
    };
  }
  if (remaining < Z_SAFETY_MM) {
    return {
      rule: "z-stack",
      status: "warn",
      title: `Only ${fmt(remaining)} mm Z headroom`,
      detail: `${breakdown}. Under ${Z_SAFETY_MM} mm margin — one long tool change away from a crash.`,
    };
  }
  return {
    rule: "z-stack",
    status: "pass",
    title: `${fmt(remaining)} mm Z clearance remaining`,
    detail: breakdown,
  };
}

interface HoleGroup {
  diameterMm: number;
  maxDepthMm: number;
  count: number;
}

function groupHoles(holes: MachiningHole[]): HoleGroup[] {
  const groups = new Map<string, HoleGroup>();
  for (const h of holes) {
    const key = h.diameter_mm.toFixed(2);
    const depth = h.depth_mm ?? 0;
    const existing = groups.get(key);
    const instances = h.instance_count ?? 1;
    if (existing) {
      existing.maxDepthMm = Math.max(existing.maxDepthMm, depth);
      existing.count += instances;
    } else {
      groups.set(key, {
        diameterMm: h.diameter_mm,
        maxDepthMm: depth,
        count: instances,
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.diameterMm - b.diameterMm);
}

function checkHoleTooling(
  holes: MachiningHole[],
  tools: ToolProfile[],
): PreflightCheck[] {
  if (holes.length === 0) return [];
  const drills = tools.filter((t) => t.type === "drill");
  const endmills = tools.filter(
    (t) => t.type === "flat_endmill" || t.type === "ballnose",
  );
  const checks: PreflightCheck[] = [];

  for (const group of groupHoles(holes)) {
    const label = `Ø${fmt(group.diameterMm, 2)} mm ×${group.count}`;
    const drill = drills.find(
      (d) =>
        Math.abs(d.diameterMm - group.diameterMm) <= DRILL_MATCH_TOLERANCE_MM,
    );

    if (drill) {
      if (group.maxDepthMm > drill.fluteLengthMm) {
        checks.push({
          rule: "hole-tooling",
          status: "fail",
          title: `${label}: drill too short`,
          detail: `Deepest bore is ${fmt(group.maxDepthMm)} mm but ${drill.label} has ${fmt(drill.fluteLengthMm)} mm of flute. Peck cycles cannot save a drill that physically ends — buy a longer drill.`,
        });
      } else {
        checks.push({
          rule: "hole-tooling",
          status: "pass",
          title: `${label}: drilled with ${drill.label}`,
          detail: `Max depth ${fmt(group.maxDepthMm)} mm within ${fmt(drill.fluteLengthMm)} mm flute length.`,
        });
      }
      continue;
    }

    const helical = endmills.find(
      (e) =>
        e.diameterMm <= group.diameterMm * HELICAL_MAX_DIA_RATIO &&
        e.fluteLengthMm >= group.maxDepthMm,
    );
    if (helical) {
      checks.push({
        rule: "hole-tooling",
        status: "info",
        title: `${label}: helical-bore with ${helical.label}`,
        detail: `No matching drill in your crib. Helical interpolation works but is slower than drilling; consider a Ø${fmt(group.diameterMm, 2)} mm drill.`,
      });
    } else {
      checks.push({
        rule: "hole-tooling",
        status: "warn",
        title: `${label}: no tool in crib`,
        detail: `No drill within ±${DRILL_MATCH_TOLERANCE_MM} mm and no endmill small and long enough to helical-bore ${fmt(group.maxDepthMm)} mm deep.`,
      });
    }
  }
  return checks;
}

function checkPocketReach(
  pockets: DetectedPocket[],
  tools: ToolProfile[],
): PreflightCheck[] {
  if (pockets.length === 0) return [];
  const endmills = tools.filter((t) => t.type === "flat_endmill");
  const deepest = pockets.reduce((a, b) => (a.depth_mm >= b.depth_mm ? a : b));
  if (endmills.length === 0) {
    return [
      {
        rule: "pocket-reach",
        status: "warn",
        title: "Pockets found, no endmill selected",
        detail: `${pockets.length} pocket(s), deepest ${fmt(deepest.depth_mm)} mm. Add a flat endmill to your crib to check reach.`,
      },
    ];
  }
  const best = endmills.reduce((a, b) =>
    a.fluteLengthMm >= b.fluteLengthMm ? a : b,
  );
  if (deepest.depth_mm > best.fluteLengthMm) {
    return [
      {
        rule: "pocket-reach",
        status: "fail",
        title: "Shank / holder collision risk",
        detail: `Deepest pocket is ${fmt(deepest.depth_mm)} mm but your longest flute (${best.label}) cuts ${fmt(best.fluteLengthMm)} mm. The un-fluted shank or holder will rub the pocket wall. Use a long-reach or necked tool.`,
      },
    ];
  }
  return [
    {
      rule: "pocket-reach",
      status: "pass",
      title: `Pockets reachable with ${best.label}`,
      detail: `Deepest pocket ${fmt(deepest.depth_mm)} mm within ${fmt(best.fluteLengthMm)} mm flute length (${pockets.length} pocket(s)).`,
    },
  ];
}

function checkFlatBottomHoles(holes: MachiningHole[]): PreflightCheck {
  const flat = holes.filter((h) => h.kind === "blind_flat");
  const drillPoint = holes.filter((h) => h.kind === "blind_drill_point");
  if (flat.length > 0) {
    return {
      rule: "flat-bottom-holes",
      status: "warn",
      title: `${flat.length} flat-bottom blind hole${flat.length === 1 ? "" : "s"}`,
      detail:
        "A standard 118°/135° drill leaves a cone at the bottom of a blind hole. A dead-flat floor needs a flat-bottom drill or slower helical interpolation with an endmill.",
    };
  }
  if (drillPoint.length > 0) {
    return {
      rule: "flat-bottom-holes",
      status: "pass",
      title: "Blind holes have standard drill points",
      detail: `${drillPoint.length} blind hole(s) show conical bottoms consistent with a standard twist drill.`,
    };
  }
  return {
    rule: "flat-bottom-holes",
    status: "pass",
    title: "No flat-bottom blind holes",
    detail: "All detected holes are through-holes or standard drill geometry.",
  };
}

function checkSharpCorners(
  result: ParseResult,
  tools: ToolProfile[],
): PreflightCheck {
  const minTool = result.quoting.min_internal_tool_diameter_mm;
  if (minTool == null) {
    return {
      rule: "sharp-corners",
      status: "info",
      title: "Inside-corner radii not resolved",
      detail:
        "No internal corner constraint detected in this model. Endmills are round — verify pocket corners in CAM.",
    };
  }
  if (minTool <= 0.2) {
    return {
      rule: "sharp-corners",
      status: "fail",
      title: "Sharp inside corners",
      detail:
        "Near-zero inside corner radius detected. An endmill cannot cut a sharp inside vertical corner — requires broaching, EDM, or relaxing the corner radius in the model.",
    };
  }
  const smallest = tools
    .filter((t) => t.type === "flat_endmill")
    .reduce<number | null>(
      (min, t) => (min == null || t.diameterMm < min ? t.diameterMm : min),
      null,
    );
  if (smallest != null && smallest > minTool) {
    return {
      rule: "sharp-corners",
      status: "warn",
      title: `Corners need a Ø${fmt(minTool, 2)} mm tool`,
      detail: `Tightest internal radius requires ≤ Ø${fmt(minTool, 2)} mm, but your smallest endmill is Ø${fmt(smallest, 2)} mm. Add a smaller tool or relax the corners.`,
    };
  }
  return {
    rule: "sharp-corners",
    status: "pass",
    title: "Inside corners reachable",
    detail: `Tightest internal feature accepts a Ø${fmt(minTool, 2)} mm tool.`,
  };
}

function checkUndercuts(result: ParseResult): PreflightCheck {
  const undercuts = result.quoting.undercuts;
  if (undercuts.length === 0) {
    return {
      rule: "undercuts",
      status: "pass",
      title: "No undercuts detected",
      detail: "All faces are reachable from a top-down setup vector.",
    };
  }
  return {
    rule: "undercuts",
    status: "warn",
    title: `${undercuts.length} undercut face${undercuts.length === 1 ? "" : "s"}`,
    detail:
      "Face normals point away from the primary Z setup and are occluded. On a 3-axis machine this means a setup flip, or a lollipop/slitting cutter.",
  };
}

function checkFiveAxis(
  result: ParseResult,
  machine: MachineProfile,
): PreflightCheck {
  if (!result.quoting.requires_5_axis) {
    return {
      rule: "five-axis",
      status: "pass",
      title: "3-axis geometry",
      detail: "No simultaneous multi-axis motion required.",
    };
  }
  if (machine.axes === 5) {
    return {
      rule: "five-axis",
      status: "warn",
      title: "5-axis features — your machine can",
      detail: `Geometry flags 5-axis work; ${machine.label} supports it. Expect longer programming.`,
    };
  }
  return {
    rule: "five-axis",
    status: "fail",
    title: "Needs 5-axis motion",
    detail: `This part flags simultaneous multi-axis features that ${machine.label} (3-axis) cannot cut. Redesign, multiple fixtures, or outsource.`,
  };
}

function machinabilityScore(
  result: ParseResult,
  checks: PreflightCheck[],
): number {
  let score = 100;
  if (result.quoting.requires_5_axis) score -= 40;
  score -= Math.min(20, result.quoting.undercuts.length * 5);
  score -= Math.max(0, (result.quoting.setup_count - 1) * 10);
  for (const c of checks) {
    if (c.status === "fail") score -= 15;
    else if (c.status === "warn") score -= 5;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function feedsChecks(
  tools: ToolProfile[],
  materialId: MaterialId,
  machine: MachineProfile,
): PreflightCheck[] {
  const material = getMaterial(materialId);
  if (!material) return [];
  return tools
    .filter((t) => t.type === "flat_endmill" || t.type === "ballnose")
    .map((tool) => {
      const rec = recommendFeeds(tool, material, machine.spindleMaxRpm);
      return {
        rule: "feeds-speeds" as const,
        status: "info" as const,
        title: `${tool.label} in ${material.label}`,
        detail: `Start near ${rec.rpm.toLocaleString()} RPM${rec.rpmClamped ? " (spindle-limited)" : ""}, ~${rec.feedMmPerMin} mm/min. Conservative carbide baseline — adjust by ear and chip color.`,
      };
    });
}
