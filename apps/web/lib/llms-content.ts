import { absoluteUrl, siteConfig } from "@/lib/site";

/** Curated llms.txt body per https://llmstxt.org/ */
export function buildLlmsTxt(): string {
  const url = siteConfig.url;

  return `# ${siteConfig.name}

> ${siteConfig.description}

${siteConfig.name} is a browser-based STEP (ISO 10303) pre-flight tool for CNC. Drop a file to check the header, list holes, size stock, and run machine/tool fit checks against your shop setup. The Rust WASM parser core is Apache-2.0; files never upload.

## Core pages

- [Home: live tools](${url}/): Pre-Flight, header, holes, stock, AAG export
- [Workbench](${url}/#parser): Drop a STEP or try sample parts (NIST CTC-01 plate, mounting plate, bracket)
- [FAQ](${url}/faq): Privacy, machines, open source

## Documentation

- [llms-full.txt](${url}/llms-full.txt): Pipeline, WASM API, HTTP API v1
- [API v1](${url}/api/v1): Example fixture handoffs (no upload)
- [GitHub](${siteConfig.githubUrl}): Open-core parser

## Technical

- [robots.txt](${url}/robots.txt)
- [sitemap.xml](${url}/sitemap.xml)
`;
}

/** Extended context for AI systems that ingest full text. */
export function buildLlmsFullTxt(): string {
  const url = siteConfig.url;

  return `# ${siteConfig.name}: Full context

> ${siteConfig.tagline}. ${siteConfig.description}

## Product summary

${siteConfig.name} is for machinists and hobby CNC users who want a fast answer to "can I make this?" before opening Fusion, Mastercam, or Carbide Create. Client-side Rust WASM parser (Apache-2.0). No cloud upload.

### Capabilities

${siteConfig.features.map((f) => `- ${f}`).join("\n")}

### How it works

${siteConfig.architecture.map((line) => `- ${line}`).join("\n")}

### Pre-Flight rules (client-side)

Machine travel fit, vise jaw opening, Z-stack clearance (vise + part + tool stickout), drill reach vs bore depth, pocket depth vs flute length (shank collision), flat-bottom blind hole flags, undercut/5-axis warnings, machinability score, starting RPM/feed from SFM baselines.

### Engine pipeline

1. **Ingest**: DATA scan, entity parse, adaptive arena
2. **Topology**: Face IR + edge adjacency
3. **Part analysis**: Units, envelope, holes, pockets, slots, undercuts
4. **AAG**: Joshi–Chang concave/convex classification
5. **Mesh**: Fan triangulation for preview (capped)

### WASM API

\`\`\`javascript
const parser = new StepParser();
parser.parse(bytes);
parser.parseQuotingOnly(bytes);
parser.cancel();
\`\`\`

### HTTP API v1 (example fixtures only)

| Endpoint | Returns |
|----------|---------|
| GET /api/v1/fixtures | Catalog |
| GET /api/v1/fixtures/{id}/handoff | Machining facts + compact AAG |

### Keywords

${siteConfig.keywords.join(", ")}

### Links

- ${url}/
- ${url}/faq
- ${siteConfig.githubUrl}
`;
}
