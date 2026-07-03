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
          Copy machining facts without the STEP file
        </h2>
        <p className="llm-handoff-strip__body">
          Hole sizes, stock envelope, and a Joshi–Chang adjacency graph. Topology
          without coordinates cannot rebuild the solid.
        </p>
        <ul className="llm-handoff-strip__facts" aria-label="Handoff contents">
          {holes > 0 && <li>{holes} hole{holes === 1 ? "" : "s"} sized for tooling</li>}
          {faces > 0 && <li>{faces} face{faces === 1 ? "" : "s"} in graph</li>}
          {edges > 0 && <li>{edges} classified concave/convex edges</li>}
          <li>Envelope, units, and setup hints</li>
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
          Paste into Claude, ChatGPT, or your shop assistant.
        </p>
      </div>
    </section>
  );
}

export function LlmHandoffLandingPromo() {
  return (
    <section className="llm-handoff-promo" aria-labelledby="llm-handoff-promo-title">
      <h2 id="llm-handoff-promo-title" className="llm-handoff-promo__title">
        STEP checks with optional AAG export
      </h2>
      <p className="llm-handoff-promo__body">
        Drop a STEP file for header, holes, and stock envelope. The AAG export is
        topology and numbers only.
      </p>
      <ul className="llm-handoff-promo__list">
        <li>
          <strong>No coordinates.</strong> Graph exports adjacency and counts,
          not mesh or XYZ to rebuild the solid.
        </li>
        <li>
          <strong>One click.</strong> Copy a prompt and facts for review or an
          external assistant.
        </li>
      </ul>
    </section>
  );
}
