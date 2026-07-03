import { absoluteUrl, siteConfig } from "@/lib/site";

/** Curated llms.txt body per https://llmstxt.org/ */
export function buildLlmsTxt(): string {
  const url = siteConfig.url;

  return `# ${siteConfig.name}

> ${siteConfig.description}

${siteConfig.name} is an **open-core** STEP (ISO 10303) check workbench: the Rust WASM parser core is Apache-2.0 and runs locally in your browser (Web Worker). Files never leave your device. Hosted editor and cloud APIs are proprietary.

## Core pages

- [Home: live tools](${url}/): Header check, hole list, stock sizer, and AAG export for STEP files
- [Workbench](${url}/#parser): Drop a STEP file or try example parts (NIST CTC-01 plate, mounting plate, machined bracket)

## Documentation

- [llms-full.txt](${url}/llms-full.txt): Extended product, pipeline, WASM API, and **HTTP API v1** summary
- [API v1 index](${url}/api/v1): Example fixture handoffs (no upload)
- [GitHub: open-core parser](${siteConfig.githubUrl})

## Technical

- [robots.txt](${url}/robots.txt): Crawler rules and sitemap reference
- [sitemap.xml](${url}/sitemap.xml): Site index
- [Web app manifest](${url}/manifest.webmanifest): PWA metadata

## Optional

- [WASM bundle](${url}/wasm/steprs_core.js): Pre-built parser glue (for developers, not marketing content)
`;
}

/** Extended context for AI systems that ingest full text. */
export function buildLlmsFullTxt(): string {
  const url = siteConfig.url;

  return `# ${siteConfig.name}: Full context

> ${siteConfig.tagline}. ${siteConfig.description}

## Product summary

${siteConfig.name} targets machinists and engineers who need to trust STEP files before CAM: verifying units, inspecting holes, and sizing stock, without uploading proprietary CAD to a cloud API. The product ships as a Next.js 15 web app with an open-core Rust WASM parser (\`steprs-core\`, Apache-2.0).

### Capabilities (public)

${siteConfig.features.map((f) => `- ${f}`).join("\n")}

### Architecture (reliable client-side system)

${siteConfig.architecture.map((line) => `- ${line}`).join("\n")}

### Roadmap (private repository)

- **Geometry editor**: bore/scale/fillet edits with STEP export — not in the public GitHub repository; Edit tab shows “Coming soon”

See OPEN_CORE.md in the GitHub repository for the open-source vs proprietary split.

### Engine pipeline (single forward pass)

1. **L0+L1 ingest**: Single DATA-section scan → prescan density → adaptive arena → nom entity parse
2. **L3 topology**: Face records + edge-indexed adjacency graph (petgraph), built once per parse
3. **L4 part analysis**: Units detection, bbox, surface area, stock volume, holes, fillets, pockets, slots, undercuts
4. **L6 AAG**: Pocket/slot detection via face adjacency patterns
5. **L7 mesh**: Triangle mesh for three.js preview (capped for WASM memory)
6. **L8 labels**: Geometry + adjacency face classifier (topology-v2 engine id)

### Production defenses

- **Sparse ID arena:** Pre-scan entity density before allocation; dense Vec vs sparse HashMap when max entity ID ≫ entity count
- **Committed WASM:** Pre-built in \`public/wasm/\`; hosting runs Next.js only
- **Worker isolation:** All parse compute off the main thread
- **No upload path:** STEP bytes stay in the browser; editor API returns 503 (editor not in public repo)

### Parser philosophy

Custom nom byte parser over \`&[u8]\`. ruststep is schema reference only, not a runtime dependency. Recursive EXPRESS tree parsing rejected for streaming WASM suitability.

### WASM API (browser)

\`\`\`javascript
const parser = new StepParser();
parser.setProgressHandler((stage) => console.log(stage));
parser.parse(bytes);              // full pipeline
parser.parseQuotingOnly(bytes);     // skip mesh + labels
parser.cancel();
\`\`\`

### HTTP API v1 (example fixtures, no upload)

Discover at \`${url}/api/v1\`. OpenAPI: \`${url}/api/v1/openapi.json\`.

| Endpoint | Returns |
|----------|---------|
| \`GET /api/v1/fixtures\` | Catalog (hole-plate, mounting-plate, machined-bracket) |
| \`GET /api/v1/fixtures/{id}\` | Summary: holes, pockets, AAG stats |
| \`GET /api/v1/fixtures/{id}/handoff\` | **SteprsHandoff**: machining facts + compact AAG + LLM prompt |
| \`GET /api/v1/fixtures/{id}/handoff?view=full\` | Full graph (larger) |
| \`GET /api/v1/fixtures/{id}/aag\` | AAG graph JSON only |

Handoff philosophy: **facts before topology**. Every response includes hole counts, envelope, setups, and surface histogram before the adjacency graph.

\`\`\`bash
curl -s ${url}/api/v1/fixtures/hole-plate/handoff | jq '.summary.holes'
curl -s -H 'Accept: text/plain' ${url}/api/v1/fixtures/mounting-plate/handoff
\`\`\`

Client SDK (web): \`import { steprs } from "@/lib/api/steprs-client"\` → \`steprs.fixtures.handoff("hole-plate")\`.

Regenerate snapshots: \`pnpm fixtures:api\` (Rust dump → \`apps/web/data/api/v1/fixtures/*.json\`).

### Keywords

${siteConfig.keywords.join(", ")}

### Canonical URL

${url}

### Links

- Home: ${url}/
- Workbench: ${url}/#parser
- llms.txt: ${url}/llms.txt
- sitemap: ${url}/sitemap.xml
- robots: ${url}/robots.txt
- GitHub: ${siteConfig.githubUrl}
`;
}
