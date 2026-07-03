/** Single source of truth for site URL, SEO, and llms.txt content. */

export const siteConfig = {
  name: "steprs.dev",
  tagline: "STEP file checks and hole list in Rust WASM",
  title: "steprs.dev | Check STEP files before CAM",
  shortTitle: "steprs.dev | Check STEP files before CAM",
  description:
    "Open-source STEP (ISO 10303-21) parser. Check the header, list holes with nearest catalog drills, and estimate stock size.",
  ogDescription:
    "STEP checks for machinists. Verify header units, list holes, estimate billet stock.",
  heroLead: "STEP checks, hole list, and stock envelope.",
  heroLeadSub: "Runs in your browser via WebAssembly.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://steprs.dev",
  locale: "en_US",
  copyrightYear: 2026,
  keywords: [
    "STEP parser rust",
    "CAD checks",
    "Joshi-Chang AAG",
    "machinist tools",
    "local CAD parser",
    "WASM geometry engine",
    "STEP file checks",
    "ISO 10303",
    "CAM prep",
    "hole tooling",
    "billet sizing",
    "client-side CAD",
    "open core CAD",
    "steprs",
  ],
  authors: [{ name: "steprs.dev", url: "https://steprs.dev" }],
  creator: "steprs.dev",
  category: "technology",
  engineVersion: "0.1.0",
  githubUrl: "https://github.com/vladimir-io/steprs-dev",
  license: {
    core: "Apache-2.0 parser",
    model: "open-core",
    note: "Parser core is Apache-2.0. Hosted app and editor are proprietary.",
  },
  architecture: [
    "Single-pass Rust WASM pipeline: ingest, topology, part analysis, and optional mesh",
    "Web Worker isolation with zero main-thread parse compute",
    "Adaptive arena with dense or sparse entity storage from prescan density",
    "Files processed entirely in-browser with no server upload path",
  ],
  features: [
    "Header check: AP203/AP214/AP242, units, and assembly flags from the STEP header. Cross-check against geometry units before CAM.",
    "Holes: Cylindrical features with nearest standard drill or endmill within ±0.15 mm. Check tap drill and clearance in CAM.",
    "Stock: Axis-aligned envelope with +0.125 in/side allowance, snapped to common billet sizes for material quotes.",
    "3D preview mesh with floor-aligned framing.",
    "Feature counts: Holes, pockets, fillets, and slots from geometry heuristics. Not a DFM audit.",
    "AAG export: Joshi–Chang adjacency graph with concave/convex edge counts for review or external tooling.",
  ],
  roadmap: [
    "Geometry editing: Bore resizing, uniform scaling, fillets, and edited STEP export (in development).",
  ],
  sections: [{ id: "parser", label: "Tools" }],
};

export function absoluteUrl(path: string): string {
  const base = siteConfig.url.replace(/\/$/, "");
  return path.startsWith("http")
    ? path
    : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
