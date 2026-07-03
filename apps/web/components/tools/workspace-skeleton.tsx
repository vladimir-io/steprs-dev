"use client";

import { cn } from "@/lib/utils";

export function WorkspaceSkeleton() {
  return (
    <div className="workbench skeleton-pulse">
      <header className="workbench__header flex items-center justify-between">
        <div className="workbench__file flex items-center gap-3">
          <div className="skeleton-circle w-3 h-3" />
          <div className="skeleton-line w-32 h-4" />
          <div className="skeleton-line w-16 h-3 rounded-full" />
        </div>
        <div className="workbench__header-actions flex gap-2">
          <div className="skeleton-line w-24 h-8 rounded-md" />
          <div className="skeleton-line w-20 h-8 rounded-md" />
        </div>
      </header>

      <div className="workbench__body">
        <div className="workbench__viewer flex items-center justify-center min-h-[400px]">
          <div className="skeleton-line w-1/3 h-5 rounded-md opacity-40" />
        </div>

        <aside className="workbench__rail flex flex-col gap-4">
          <div className="part-summary flex flex-col gap-2">
            <div className="skeleton-line w-1/2 h-5" />
            <div className="skeleton-line w-3/4 h-3" />
            <div className="flex gap-2 mt-2">
              <div className="skeleton-line w-12 h-6 rounded-md" />
              <div className="skeleton-line w-12 h-6 rounded-md" />
              <div className="skeleton-line w-12 h-6 rounded-md" />
            </div>
          </div>

          <div className="tool-segment flex p-1 rounded-full gap-1">
            <div className="skeleton-line flex-1 h-8 rounded-full" />
            <div className="skeleton-line flex-1 h-8 rounded-full" />
            <div className="skeleton-line flex-1 h-8 rounded-full" />
            <div className="skeleton-line flex-1 h-8 rounded-full" />
          </div>

          <div className="workbench-panel flex flex-col gap-3 p-4 border border-dashed border-muted/20 rounded-lg">
            <div className="skeleton-line w-1/3 h-4" />
            <div className="skeleton-line w-full h-3" />
            <div className="skeleton-line w-5/6 h-3" />
            <div className="skeleton-line w-2/3 h-3" />
          </div>
        </aside>
      </div>
    </div>
  );
}
