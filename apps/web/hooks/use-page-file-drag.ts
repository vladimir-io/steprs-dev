"use client";

import { useEffect, useState } from "react";

function isFileDrag(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/** True while the user is dragging files over the browser window. */
export function usePageFileDrag(enabled: boolean) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsDragging(false);
      return;
    }

    let depth = 0;

    const onDragEnter = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      depth += 1;
      setIsDragging(true);
    };

    const onDragLeave = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      depth -= 1;
      if (depth <= 0) {
        depth = 0;
        setIsDragging(false);
      }
    };

    const onDragOver = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
    };

    const onDrop = () => {
      depth = 0;
      setIsDragging(false);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [enabled]);

  return isDragging;
}
