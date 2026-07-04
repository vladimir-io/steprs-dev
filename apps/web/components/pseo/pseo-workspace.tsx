"use client";

import { useState, useCallback } from "react";
import { PreflightPanel } from "@/components/tools/preflight-panel";
import type { ParseResult } from "@steprs/ts-types";
import { usePreflightConfig } from "@/hooks/use-preflight-config";

interface PseoWorkspaceProps {
  partName: string;
  result: ParseResult;
  initialMachineId: string;
}

export function PseoWorkspace({ partName, result, initialMachineId }: PseoWorkspaceProps) {
  // We rely on usePreflightConfig which uses jotai under the hood, but we want to initialize it
  // with the machine ID from the URL if it's not already set to something else, or maybe just let 
  // the user's persisted state take over. However, for a landing page, we want the machine to match the route!
  const { config, updateConfig } = usePreflightConfig();

  // Force the machine ID on first render if it differs from the route.
  // We use a simple effect-less check to avoid flicker if possible, 
  // but a useEffect is safer to avoid render-phase state mutations.
  useState(() => {
    if (config.machineId !== initialMachineId) {
      updateConfig({ machineId: initialMachineId });
    }
  });

  return (
    <div className="pseo-workspace-container">
      <div className="pseo-workspace-glass">
        <PreflightPanel
          result={result}
          isParsing={false}
          fileName={`${partName}.step`}
        />
      </div>
      <style jsx>{`
        .pseo-workspace-container {
          background: var(--steprs-bg);
          padding: 2rem;
          border-radius: 12px;
          border: 1px solid var(--steprs-border);
          max-width: 900px;
          margin: 0 auto;
        }
        .pseo-workspace-glass {
          background: var(--steprs-surface);
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
