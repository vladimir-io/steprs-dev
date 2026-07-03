import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[11px] text-muted",
  {
    variants: {
      variant: {
        default: "border-border bg-surface-elevated",
        muted: "border-border bg-surface-elevated",
        warning: "border-neutral-600 text-neutral-300",
        success: "border-neutral-600 text-neutral-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}
