/**
 * Production feature gates.
 * Set NEXT_PUBLIC_ENABLE_EDIT=true locally to preview the editor tab.
 */
export const productFlags = {
  editEnabled: process.env.NEXT_PUBLIC_ENABLE_EDIT === "true",
} as const;
