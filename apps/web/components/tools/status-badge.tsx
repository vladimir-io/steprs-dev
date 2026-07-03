import { cn } from "@/lib/utils";
import type { InspectStatus } from "@/lib/step-header";

interface StatusBadgeProps {
  label: string;
  value: string;
  status: InspectStatus;
  detail?: string;
  /** Long technical strings go in a collapsible block. */
  technical?: boolean;
}

const statusCopy: Record<InspectStatus, string> = {
  pass: "OK",
  warn: "Review",
  unknown: "n/a",
};

export function StatusBadge({
  label,
  value,
  status,
  detail,
  technical = false,
}: StatusBadgeProps) {
  const useRawBlock = Boolean(
    detail && (technical || detail.length > 52),
  );

  return (
    <div className={cn("schema-field", `schema-field--${status}`)}>
      <div className="schema-field__head">
        <span className="schema-field__key">{label}</span>
        <span className="schema-field__state" title={`Status: ${status}`}>
          {statusCopy[status]}
        </span>
      </div>

      <p className="schema-field__value">{value}</p>

      {detail && !useRawBlock && (
        <p className="schema-field__detail">{detail}</p>
      )}

      {detail && useRawBlock && (
        <details className="schema-field__expand">
          <summary>
            <span className="schema-field__chevron" aria-hidden />
            Source string
          </summary>
          <pre>{detail}</pre>
        </details>
      )}
    </div>
  );
}
