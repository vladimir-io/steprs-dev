"use client";

import type { ParseResult } from "@steprs/ts-types";

import { LlmHandoffCopyButton } from "./llm-handoff-copy-button";

interface LlmHandoffStripProps {
  result: ParseResult;
  fileName?: string;
  className?: string;
  onCopied?: () => void;
}

export function LlmHandoffStrip({
  result,
  fileName,
  className,
  onCopied,
}: LlmHandoffStripProps) {
  const holes = result.quoting.holes?.length ?? 0;
  const faces = result.aag?.face_count ?? 0;
  const edges =
    (result.aag?.concave_edge_count ?? 0) + (result.aag?.convex_edge_count ?? 0);

  return (
    <section
      className={className ? `llm-handoff-strip ${className}` : "llm-handoff-strip"}
      aria-labelledby="llm-handoff-strip-title"
    >
      <div className="llm-handoff-strip__copy">
        <p className="llm-handoff-strip__eyebrow">Export</p>
        <h2 id="llm-handoff-strip-title" className="llm-handoff-strip__title">
          Copy hole list and envelope
        </h2>
        <p className="llm-handoff-strip__body">
          Hole sizes, stock envelope, face adjacency. No coordinates.
        </p>
        <ul className="llm-handoff-strip__facts" aria-label="Handoff contents">
          {holes > 0 && <li>{holes} hole{holes === 1 ? "" : "s"}</li>}
          {faces > 0 && <li>{faces} face{faces === 1 ? "" : "s"} in graph</li>}
          {edges > 0 && <li>{edges} concave/convex edges</li>}
          <li>Units and setup hints</li>
        </ul>
      </div>
      <div className="llm-handoff-strip__action">
        <LlmHandoffCopyButton
          result={result}
          fileName={fileName}
          variant="primary"
          onCopied={onCopied}
        />
        <p className="llm-handoff-strip__hint">
          Paste into job notes or your CAM planning doc.
        </p>
      </div>
    </section>
  );
}

export function LlmHandoffLandingPromo() {
  return (
    <section className="llm-handoff-promo" aria-labelledby="llm-handoff-promo-title">
      <h2 id="llm-handoff-promo-title" className="llm-handoff-promo__title">
        Export hole list and envelope
      </h2>
      <p className="llm-handoff-promo__body">
        Copy machining facts for job notes. Topology only — no coordinates to
        rebuild the solid.
      </p>
    </section>
  );
}
