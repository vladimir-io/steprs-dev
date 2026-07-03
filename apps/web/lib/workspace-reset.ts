export const WORKSPACE_RESET_EVENT = "steprs:workspace-reset";

export function dispatchWorkspaceReset(): void {
  window.dispatchEvent(new CustomEvent(WORKSPACE_RESET_EVENT));
}

export function onWorkspaceReset(listener: () => void): () => void {
  window.addEventListener(WORKSPACE_RESET_EVENT, listener);
  return () => window.removeEventListener(WORKSPACE_RESET_EVENT, listener);
}
