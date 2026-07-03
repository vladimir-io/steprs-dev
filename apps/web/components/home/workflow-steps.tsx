import { cn } from "@/lib/utils";

const STEPS = [
  { id: "drop", label: "Load" },
  { id: "triage", label: "Check" },
  { id: "export", label: "Export" },
] as const;

export function WorkflowSteps() {
  return (
    <ol className="workflow-rail" aria-label="Work sequence">
      {STEPS.map((step, index) => (
        <li
          key={step.id}
          className={cn(
            "workflow-rail__item reveal",
            index === 0 && "workflow-rail__item--current",
          )}
        >
          <span className="workflow-rail__index">{index + 1}</span>
          <span className="workflow-rail__label">{step.label}</span>
          {index < STEPS.length - 1 && (
            <span className="workflow-rail__connector" aria-hidden />
          )}
        </li>
      ))}
    </ol>
  );
}
