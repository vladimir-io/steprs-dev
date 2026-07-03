/** Single source of truth for site URL, SEO, and llms.txt content. */

export const siteConfig = {
  name: "steprs.dev",
  tagline: "STEP pre-flight before CAM",
  title: "steprs.dev | STEP pre-flight before CAM",
  shortTitle: "steprs.dev | STEP pre-flight before CAM",
  description:
    "Drop a STEP file. Check units, holes, stock size, and whether the part fits your machine and tools. Runs in your browser — nothing uploads.",
  ogDescription:
    "STEP pre-flight for CNC: header, holes, stock, machine fit, tool reach. Local in the browser.",
  heroLead: "Drop a STEP. Check it before you open CAM.",
  heroLeadSub: "Units, holes, stock, machine fit — in your browser.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://steprs.dev",
  locale: "en_US",
  copyrightYear: 2026,
  keywords: [
    "STEP file checker",
    "CAM pre-flight",
    "CNC pre-flight",
    "STEP holes",
    "stock sizing CNC",
    "STEP parser browser",
    "Shapeoko STEP",
    "hobby CNC",
    "machinist tools",
    "tool crib",
    "machine envelope",
    "ISO 10303",
    "STEP units check",
    "billet sizing",
    "client-side STEP",
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
    note: "Parser core is Apache-2.0 on GitHub. Hosted app shell is proprietary.",
  },
  architecture: [
    "Rust WASM parser in a Web Worker — main thread stays free",
    "Single pass: ingest, topology, holes, stock, optional mesh",
    "Files stay on your machine; no upload path",
  ],
  features: [
    "Pre-Flight: Pick your machine, vise, and tool crib. Flags travel fit, Z clearance, drill reach, shank collision, flat-bottom blind holes, and undercuts.",
    "Header: AP protocol, units, assembly flags from the STEP header.",
    "Holes: Cylindrical features with nearest catalog drill or endmill (±0.15 mm).",
    "Stock: Part envelope with allowance, snapped to common billet sizes.",
    "3D preview with floor-aligned framing.",
    "AAG export: Face adjacency with concave/convex counts — topology only, no coordinates.",
  ],
  roadmap: [
    "Geometry editing (bore resize, fillets, STEP export) — private development.",
  ],
  sections: [{ id: "parser", label: "Tools" }],
};

export function absoluteUrl(path: string): string {
  const base = siteConfig.url.replace(/\/$/, "");
  return path.startsWith("http")
    ? path
    : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
