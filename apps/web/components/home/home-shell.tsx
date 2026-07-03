import type { ReactNode } from "react";

interface HomeShellProps {
  workspace: ReactNode;
}

/** Full-viewport workspace shell — drop zone fills the page when idle. */
export function HomeShell({ workspace }: HomeShellProps) {
  return <div className="home-shell">{workspace}</div>;
}
