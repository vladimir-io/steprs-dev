/** Pipeline stage labels — keep in sync with crates/steprs-core/src/core/mod.rs */

export const PIPELINE_STAGES = [
  "L0 prescan",
  "L1 parse",
  "L3 topology",
  "L4 part metrics",
  "L6 aag",
  "L7 mesh",
  "L8 labels",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

const STAGE_USER_LABELS: Record<PipelineStage, string> = {
  "L0 prescan": "Prescan",
  "L1 parse": "Parse entities",
  "L3 topology": "Topology",
  "L4 part metrics": "Part metrics",
  "L6 aag": "AAG",
  "L7 mesh": "Preview mesh",
  "L8 labels": "Feature labels",
};

export function pipelineStageUserLabel(stage: PipelineStage): string {
  return STAGE_USER_LABELS[stage];
}

export function stageProgress(stage: string): number {
  if (stage === "complete") return 1;
  if (stage === "error") return 0;
  if (stage === "reading file" || stage === "idle") return 0.04;

  const idx = PIPELINE_STAGES.indexOf(stage as PipelineStage);
  if (idx >= 0) {
    return (idx + 1) / PIPELINE_STAGES.length;
  }

  // Partial match for unexpected labels
  const fuzzy = PIPELINE_STAGES.findIndex((s) => stage.includes(s));
  if (fuzzy >= 0) return (fuzzy + 1) / PIPELINE_STAGES.length;

  return 0.1;
}

export function stageLabel(stage: string): string {
  if (stage === "reading file") return "Reading file…";
  if (stage === "complete") return "Complete";
  if (stage === "error") return "Failed";
  if (stage === "idle") return "Ready";
  if (PIPELINE_STAGES.includes(stage as PipelineStage)) {
    return pipelineStageUserLabel(stage as PipelineStage);
  }
  return stage;
}
