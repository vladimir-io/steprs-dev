/** Brand typography — hex wordmark, no logo mark */
export const brandAssets = {
  icon: "/icon.png",
} as const;

export type BrandLoaderSize = "xs" | "sm" | "md" | "lg";

export const brandLoaderSizes: Record<BrandLoaderSize, number> = {
  xs: 28,
  sm: 44,
  md: 72,
  lg: 112,
};
