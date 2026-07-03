"use client";

import type { TriageStep, TriageStepId } from "@/lib/analysis/triage-progress";
import { cn } from "@/lib/utils";

interface TriageChecklistProps {
  steps: TriageStep[];
  onStepSelect: (id: TriageStepId) => void;
  className?: string;
}

function StepMark({ status }: { status: TriageStep["status"] }) {
  if (status === "done") {
    return (
      <span className="triage-checklist__mark triage-checklist__mark--done" aria-hidden>
        ✓
      </span>
    );
  }
  if (status === "review") {
    return (
      <span className="triage-checklist__mark triage-checklist__mark--review" aria-hidden>
        ·
      </span>
    );
  }
  return <span className="triage-checklist__mark" aria-hidden />;
}

export function TriageChecklist({
  steps,
  onStepSelect,
  className,
}: TriageChecklistProps) {
  return (
    <nav
      className={cn("triage-checklist", className)}
      aria-label="Triage progress"
    >
      <ol className="triage-checklist__list">
        {steps.map((step, index) => (
          <li key={step.id} className="triage-checklist__item">
            <button
              type="button"
              className={cn(
                "triage-checklist__step",
                step.status === "active" && "triage-checklist__step--active",
                step.status === "done" && "triage-checklist__step--done",
                step.status === "review" && "triage-checklist__step--review",
              )}
              onClick={() => onStepSelect(step.id)}
              aria-current={step.status === "active" ? "step" : undefined}
            >
              <StepMark status={step.status} />
              <span className="triage-checklist__label">{step.label}</span>
            </button>
            {index < steps.length - 1 && (
              <span className="triage-checklist__sep" aria-hidden />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
