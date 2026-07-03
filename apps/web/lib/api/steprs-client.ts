/**
 * Steprs HTTP client — minimal fetch wrapper for the public v1 API.
 *
 * ```ts
 * import { steprs } from "@/lib/api/steprs-client";
 *
 * const catalog = await steprs.fixtures.list();
 * const handoff = await steprs.fixtures.handoff("hole-plate");
 * console.log(handoff.summary.holes.count); // 10
 * console.log(handoff.prompt); // paste into Claude
 * ```
 */

import type { AagFaceNode } from "@steprs/ts-types";

import type { SteprsHandoff, SteprsHandoffView } from "./types";

const DEFAULT_BASE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")
    : "";

export interface SteprsClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
}

export function createSteprsClient(options: SteprsClientOptions = {}) {
  const base = (options.baseUrl ?? DEFAULT_BASE).replace(/\/$/, "");
  const http = options.fetch ?? fetch;

  async function getJson<T>(path: string): Promise<T> {
    const res = await http(`${base}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new SteprsApiError(res.status, await res.text());
    }
    return res.json() as Promise<T>;
  }

  return {
    index: () => getJson<Record<string, unknown>>("/api/v1"),

    fixtures: {
      list: () =>
        getJson<{ api_version: string; fixtures: unknown[] }>("/api/v1/fixtures"),

      get: (id: string) => getJson<Record<string, unknown>>(`/api/v1/fixtures/${id}`),

      handoff: (id: string, view: SteprsHandoffView = "compact") =>
        getJson<SteprsHandoff>(
          `/api/v1/fixtures/${id}/handoff${view === "full" ? "?view=full" : ""}`,
        ),

      handoffText: async (id: string, view: SteprsHandoffView = "compact") => {
        const res = await http(
          `${base}/api/v1/fixtures/${id}/handoff${view === "full" ? "?view=full" : ""}`,
          { headers: { Accept: "text/plain" } },
        );
        if (!res.ok) throw new SteprsApiError(res.status, await res.text());
        return res.text();
      },

      aag: (id: string, view: SteprsHandoffView = "full") =>
        getJson<AagFaceNode[]>(
          `/api/v1/fixtures/${id}/aag${view === "compact" ? "?view=compact" : ""}`,
        ),
    },
  };
}

export class SteprsApiError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`steprs API ${status}: ${body.slice(0, 200)}`);
    this.name = "SteprsApiError";
  }
}

/** Default client — uses NEXT_PUBLIC_SITE_URL when set. */
export const steprs = createSteprsClient();
