/**
 * Production feature gates for the public open-core repository.
 * Geometry editor lives in a private repository — always disabled here.
 * Set NEXT_PUBLIC_ENABLE_ANALYTICS=true only on private operator deployments.
 */
export const productFlags = {
  editEnabled: false,
  analyticsEnabled: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true",
} as const;
