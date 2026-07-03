"use client";

import type { SamplePart, SamplePartId } from "@/lib/sample-part";
import { SAMPLE_PARTS } from "@/lib/sample-part";
import { cn } from "@/lib/utils";

interface SampleGalleryProps {
  onSelect: (id: SamplePartId) => void;
  disabled?: boolean;
  className?: string;
}

export function SampleGallery({
  onSelect,
  disabled = false,
  className,
}: SampleGalleryProps) {
  return (
    <section className={cn("sample-gallery", className)} aria-label="Example parts">
      <header className="sample-gallery__head">
        <h2 className="sample-gallery__title">Samples</h2>
      </header>
      <ul className="sample-gallery__grid">
        {SAMPLE_PARTS.map((part, index) => (
          <li key={part.id}>
            <SampleCard
              part={part}
              delay={index}
              disabled={disabled}
              onSelect={() => onSelect(part.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SampleCard({
  part,
  delay,
  disabled,
  onSelect,
}: {
  part: SamplePart;
  delay: number;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="sample-card reveal"
      style={{ animationDelay: `${0.12 + delay * 0.05}s` }}
      disabled={disabled}
      data-testid={`sample-card-${part.id}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <span className="sample-card__label">{part.label}</span>
      <span className="sample-card__teaser">{part.teaser}</span>
    </button>
  );
}
