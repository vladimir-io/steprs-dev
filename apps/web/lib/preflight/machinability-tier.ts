export interface MachinabilityTier {
  score: number;
  label: string;
  slug: string;
}

/** Human-readable machinability band for social sharing. */
export function getMachinabilityTier(score: number): MachinabilityTier {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped >= 90) {
    return { score: clamped, label: "Clean Cut", slug: "clean-cut" };
  }
  if (clamped >= 75) {
    return { score: clamped, label: "Shop Ready", slug: "shop-ready" };
  }
  if (clamped >= 50) {
    return { score: clamped, label: "Needs Review", slug: "needs-review" };
  }
  if (clamped >= 25) {
    return { score: clamped, label: "Headache", slug: "headache" };
  }
  return { score: clamped, label: "Nightmare Fuel", slug: "nightmare-fuel" };
}
