import { absoluteUrl, siteConfig } from "@/lib/site";

import type { SteprsApiIndex } from "./types";
import { STEPRS_API_VERSION } from "./types";

export function buildApiIndex(): SteprsApiIndex {
  const base = absoluteUrl("/api/v1");

  return {
    api_version: STEPRS_API_VERSION,
    name: "steprs",
    description:
      "Local-first STEP checks API. Example fixtures ship with precomputed parse snapshots. No upload required.",
    docs: absoluteUrl("/llms-full.txt"),
    openapi: absoluteUrl("/api/v1/openapi.json"),
    fixtures: `${base}/fixtures`,
    philosophy: [
      "Facts before topology. Machining summary precedes the AAG graph in every handoff.",
      "Compact by default. LLM exports prioritize concave/cylindrical faces (48 nodes).",
      "Full graph on demand. ?view=full for complete adjacency.",
      "Same contract in-browser (WASM) and on the wire (fixture snapshots).",
      "No upload path. Your STEP files stay on the client.",
    ],
    endpoints: [
      {
        method: "GET",
        path: "/api/v1",
        description: "API index (this document)",
      },
      {
        method: "GET",
        path: "/api/v1/openapi.json",
        description: "OpenAPI 3.1 schema",
      },
      {
        method: "GET",
        path: "/api/v1/fixtures",
        description: "Catalog of example parts with live links",
      },
      {
        method: "GET",
        path: "/api/v1/fixtures/{id}",
        description: "Fixture summary (holes, AAG stats, links)",
      },
      {
        method: "GET",
        path: "/api/v1/fixtures/{id}/handoff",
        description: "LLM handoff: prompt + compact graph + machining summary",
      },
      {
        method: "GET",
        path: "/api/v1/fixtures/{id}/handoff?view=full",
        description: "Full graph handoff (larger payload)",
      },
      {
        method: "GET",
        path: "/api/v1/fixtures/{id}/aag",
        description: "AAG graph JSON only",
      },
    ],
  };
}

export function buildOpenApiSpec() {
  const url = siteConfig.url.replace(/\/$/, "");

  return {
    openapi: "3.1.0",
    info: {
      title: "steprs API",
      version: STEPRS_API_VERSION,
      description:
        "Public read API for steprs.dev example fixtures. Client-side WASM parsing uses the same handoff contract.",
      contact: { name: "steprs.dev", url },
    },
    servers: [{ url: `${url}/api/v1` }],
    paths: {
      "/fixtures": {
        get: {
          summary: "List example fixtures",
          operationId: "listFixtures",
          responses: {
            "200": {
              description: "Fixture catalog",
            },
          },
        },
      },
      "/fixtures/{id}": {
        get: {
          summary: "Fixture summary",
          operationId: "getFixture",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { enum: ["hole-plate", "mounting-plate", "machined-bracket"] },
            },
          ],
          responses: {
            "200": { description: "Summary" },
            "404": { description: "Unknown fixture" },
          },
        },
      },
      "/fixtures/{id}/handoff": {
        get: {
          summary: "LLM handoff (prompt + graph + summary)",
          operationId: "getHandoff",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { enum: ["hole-plate", "mounting-plate", "machined-bracket"] },
            },
            {
              name: "view",
              in: "query",
              schema: { enum: ["compact", "full"], default: "compact" },
            },
          ],
          responses: {
            "200": { description: "SteprsHandoff" },
            "404": { description: "Unknown fixture" },
          },
        },
      },
      "/fixtures/{id}/aag": {
        get: {
          summary: "AAG graph JSON",
          operationId: "getAag",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { enum: ["hole-plate", "mounting-plate", "machined-bracket"] },
            },
            {
              name: "view",
              in: "query",
              schema: { enum: ["compact", "full"], default: "full" },
            },
          ],
          responses: {
            "200": { description: "AagFaceNode[]" },
            "404": { description: "Unknown fixture" },
          },
        },
      },
    },
  };
}
