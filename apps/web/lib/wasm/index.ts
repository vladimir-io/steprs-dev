export const WASM_BASE_PATH = "/wasm";
export const WASM_JS_PATH = `${WASM_BASE_PATH}/steprs_core.js`;

export type { ParseResult, WorkerInboundMessage, WorkerOutboundMessage } from "@steprs/ts-types";

export function createParserWorker(): Worker {
  return new Worker(
    new URL("../../workers/step-parser.worker.ts", import.meta.url),
    { type: "module" },
  );
}
