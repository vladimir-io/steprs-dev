/**
 * Production feature gates.
 * Set NEXT_PUBLIC_ENABLE_EDIT=true locally to preview the editor tab.
 * Set NEXT_PUBLIC_ENABLE_ANALYTICS=true only on private operator deployments.
 */
export const productFlags = {
  editEnabled: process.env.NEXT_PUBLIC_ENABLE_EDIT === "true",
  analyticsEnabled: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true",
} as const;
