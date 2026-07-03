"use client";

import { BrandLoader } from "@/components/brand/brand-loader";
import { PIPELINE_STAGES, pipelineStageUserLabel, stageLabel, stageProgress } from "@/lib/pipeline-stages";
import { cn } from "@/lib/utils";

interface ParseProgressProps {
  stage: string;
  completedStages?: string[];
}

export function ParseProgress({ stage, completedStages = [] }: ParseProgressProps) {
  const progress = stageProgress(stage);
  const pct = Math.round(progress * 100);

  return (
    <div
      className="glass-panel rounded-sm px-4 py-3"
      role="status"
      aria-live="polite"
      aria-label={`Parsing: ${stageLabel(stage)}`}
    >
      <div className="flex items-center gap-3">
        <BrandLoader size="xs" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="font-mono text-muted">{stageLabel(stage)}</span>
            <span className="font-mono text-foreground">{pct}%</span>
          </div>
        </div>
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-white/40 to-white/80 transition-[width] duration-300"
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>

      <ol className="mt-3 flex flex-wrap gap-2 font-mono text-[10px]">
        {PIPELINE_STAGES.map((label) => {
          const currentIdx = PIPELINE_STAGES.indexOf(
            stage as (typeof PIPELINE_STAGES)[number],
          );
          const labelIdx = PIPELINE_STAGES.indexOf(label);
          const done =
            completedStages.includes(label) ||
            stage === "complete" ||
            (currentIdx >= 0 && labelIdx >= 0 && labelIdx < currentIdx);
          const active = stage === label;

          return (
            <li
              key={label}
              className={cn(
                "rounded-md px-2 py-0.5",
                done && "bg-white/[0.06] text-foreground",
                active && !done && "bg-white/[0.08] text-foreground",
                !done && !active && "text-muted-foreground",
              )}
            >
              {pipelineStageUserLabel(label)}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
