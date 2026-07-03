/// <reference lib="webworker" />

import { MAX_PARSE_FILE_BYTES } from "../lib/file-guardrails";
import {
  assembleParseResult,
  type ParseWirePayload,
} from "../lib/preview/mesh-wire";
import type {
  EditOp,
  EditResult,
  ModelSnapshot,
  ParseOptions,
  ParseResult,
  VerifySpec,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from "@steprs/ts-types";

type StepParserInstance = {
  parse: (bytes: Uint8Array) => string;
  parseWithOptions: (
    bytes: Uint8Array,
    includeMesh: boolean,
    includeLabels: boolean,
  ) => string;
  parseWithOptionsWire: (
    bytes: Uint8Array,
    includeMesh: boolean,
    includeLabels: boolean,
  ) => ParseWirePayload;
  parseQuotingOnly: (bytes: Uint8Array) => string;
  setProgressHandler: (handler: (stage: string) => void) => void;
  cancel: () => void;
  openSession?: (bytes: Uint8Array) => string;
  openSessionWithOptions?: (
    bytes: Uint8Array,
    includeMesh: boolean,
    includeLabels: boolean,
  ) => string;
  getSnapshot?: () => string;
  getParseResult?: () => string;
  getParseResultWire?: () => ParseWirePayload;
  applyEdits?: (opsJson: string, verifyJson?: string) => string;
  undo?: () => string;
  redo?: () => string;
  exportStep?: () => Uint8Array;
  hasSession?: () => boolean;
  closeSession?: () => void;
  exportEditTriplet?: (instruction: string, opsJson: string) => string;
};

type EditorStepParser = StepParserInstance & {
  getSnapshot: () => string;
  getParseResultWire: () => ParseWirePayload;
  applyEdits: (opsJson: string, verifyJson?: string) => string;
  undo: () => string;
  redo: () => string;
  exportStep: () => Uint8Array;
  closeSession: () => void;
};

function requireEditorParser(id: string): EditorStepParser | null {
  if (
    !parser?.getSnapshot ||
    !parser.getParseResultWire ||
    !parser.applyEdits ||
    !parser.undo ||
    !parser.redo ||
    !parser.exportStep ||
    !parser.closeSession
  ) {
    post({
      type: "error",
      id,
      message: "Editor session APIs are not available in this WASM build.",
    });
    return null;
  }
  return parser as EditorStepParser;
}

type WasmModule = {
  default: (input?: WebAssembly.Module | BufferSource) => Promise<void>;
  StepParser: new () => StepParserInstance;
};

let parser: StepParserInstance | null = null;
let activeRequestId: string | null = null;
let currentFileName = "edited.step";
let lastProgressStage = "";
let lastProgressAt = 0;

async function initWasm(): Promise<void> {
  const wasmUrl = `${self.location.origin}/wasm/steprs_core.js`;
  const wasm = (await import(/* webpackIgnore: true */ wasmUrl)) as WasmModule;
  await wasm.default();
  parser = new wasm.StepParser();
  parser.setProgressHandler((stage: string) => {
    if (!activeRequestId) return;
    const now = Date.now();
    if (stage === lastProgressStage && now - lastProgressAt < 80) {
      return;
    }
    lastProgressStage = stage;
    lastProgressAt = now;
    post({ type: "progress", id: activeRequestId, stage });
  });
}

function post(message: WorkerOutboundMessage, transfers?: Transferable[]) {
  if (transfers?.length) {
    self.postMessage(message, transfers);
  } else {
    self.postMessage(message);
  }
}

const defaultOptions: ParseOptions = {
  include_mesh: true,
  include_labels: false,
};

let parseChain: Promise<void> = Promise.resolve();
let parseGeneration = 0;

function enqueueParse(task: () => Promise<void>): void {
  parseChain = parseChain.then(task).catch((err) => {
    const errorMessage =
      err instanceof Error ? err.message : "Parse failed unexpectedly.";
    if (activeRequestId) {
      post({ type: "error", id: activeRequestId, message: errorMessage });
      activeRequestId = null;
    }
  });
}

function bumpParseGeneration(): number {
  parseGeneration += 1;
  return parseGeneration;
}

function parseWithWire(
  bytes: Uint8Array,
  options: ParseOptions,
): { result: ParseResult; transfers: Transferable[] } {
  const wire = parser!.parseWithOptionsWire(
    bytes,
    options.include_mesh,
    options.include_labels,
  );
  return assembleParseResult(wire);
}

function postParseResult(
  id: string,
  generation: number,
  payload: { result: ParseResult; transfers: Transferable[] },
  snapshot?: ModelSnapshot,
) {
  if (generation !== parseGeneration) return;
  if (activeRequestId !== id) return;
  post(
    {
      type: "result",
      id,
      result: payload.result,
      snapshot,
    },
    payload.transfers,
  );
  activeRequestId = null;
}

async function handleParse(message: Extract<WorkerInboundMessage, { type: "parse" }>) {
  const generation = bumpParseGeneration();

  try {
  if (message.bytes.byteLength > MAX_PARSE_FILE_BYTES) {
    post({
      type: "error",
      id: message.id,
      message: "File exceeds size limit.",
    });
    return;
  }

  if (activeRequestId && activeRequestId !== message.id) {
    parser!.cancel();
    if (parser!.hasSession?.()) {
      parser!.closeSession?.();
    }
  }

  activeRequestId = message.id;
  const options = message.options ?? defaultOptions;
  const bytes = new Uint8Array(message.bytes);
  if (message.fileName) {
    currentFileName = message.fileName.replace(/\.step$/i, "") + ".step";
  }

  if (message.openEditor) {
    if (!parser!.openSessionWithOptions) {
      post({
        type: "error",
        id: message.id,
        message: "Editor session APIs are not available in this WASM build.",
      });
      return;
    }
    if (parser!.hasSession?.()) {
      parser!.closeSession?.();
    }

    const snapJson = parser!.openSessionWithOptions(
      bytes,
      options.include_mesh,
      options.include_labels,
    );
    const snapshot = JSON.parse(snapJson) as ModelSnapshot;
    const payload = assembleParseResult(parser!.getParseResultWire!());
    postParseResult(message.id, generation, payload, snapshot);
    return;
  }

  const payload = parseWithWire(bytes, options);
  postParseResult(message.id, generation, payload);
  } catch (err) {
    if (generation !== parseGeneration) return;
    const errorMessage =
      err instanceof Error ? err.message : "Could not parse this STEP file.";
    post({ type: "error", id: message.id, message: errorMessage });
    if (activeRequestId === message.id) {
      activeRequestId = null;
    }
  }
}

self.onmessage = async (event: MessageEvent<WorkerInboundMessage>) => {
  const message = event.data;

  try {
    if (message.type === "init") {
      await initWasm();
      post({ type: "ready" });
      return;
    }

    if (message.type === "cancel") {
      bumpParseGeneration();
      parser?.cancel();
      if (parser?.hasSession?.()) {
        parser.closeSession?.();
      }
      activeRequestId = null;
      return;
    }

    if (!parser) {
      await initWasm();
    }

    if (message.type === "parse") {
      enqueueParse(async () => {
        await handleParse(message);
      });
      return;
    }

    if (message.type === "editor_snapshot") {
      const editor = requireEditorParser(message.id);
      if (!editor) return;
      const snapJson = editor.getSnapshot();
      const payload = assembleParseResult(editor.getParseResultWire());
      post(
        {
          type: "editor_snapshot",
          id: message.id,
          snapshot: JSON.parse(snapJson) as ModelSnapshot,
          parseResult: payload.result,
        },
        payload.transfers,
      );
      return;
    }

    if (message.type === "editor_apply") {
      const editor = requireEditorParser(message.id);
      if (!editor) return;
      const verifyJson = message.verify
        ? JSON.stringify(message.verify)
        : undefined;
      const editJson = editor.applyEdits(
        JSON.stringify(message.ops),
        verifyJson,
      );
      const editResult = JSON.parse(editJson) as EditResult;
      const payload = assembleParseResult(editor.getParseResultWire());
      post(
        {
          type: "editor_edit",
          id: message.id,
          editResult,
          parseResult: payload.result,
        },
        payload.transfers,
      );
      return;
    }

    if (message.type === "editor_undo") {
      const editor = requireEditorParser(message.id);
      if (!editor) return;
      const stateJson = editor.undo();
      const state = JSON.parse(stateJson) as {
        snapshot: ModelSnapshot;
        can_undo: boolean;
        can_redo: boolean;
      };
      const payload = assembleParseResult(editor.getParseResultWire());
      post(
        {
          type: "editor_undo",
          id: message.id,
          snapshot: state.snapshot,
          parseResult: payload.result,
          canUndo: state.can_undo,
          canRedo: state.can_redo,
        },
        payload.transfers,
      );
      return;
    }

    if (message.type === "editor_redo") {
      const editor = requireEditorParser(message.id);
      if (!editor) return;
      const stateJson = editor.redo();
      const state = JSON.parse(stateJson) as {
        snapshot: ModelSnapshot;
        can_undo: boolean;
        can_redo: boolean;
      };
      const payload = assembleParseResult(editor.getParseResultWire());
      post(
        {
          type: "editor_redo",
          id: message.id,
          snapshot: state.snapshot,
          parseResult: payload.result,
          canUndo: state.can_undo,
          canRedo: state.can_redo,
        },
        payload.transfers,
      );
      return;
    }

    if (message.type === "editor_export") {
      const editor = requireEditorParser(message.id);
      if (!editor) return;
      const bytes = editor.exportStep();
      post({
        type: "editor_export",
        id: message.id,
        bytes: bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
        fileName: currentFileName,
      });
      return;
    }

    if (message.type === "editor_close") {
      const editor = requireEditorParser(message.id);
      if (!editor) return;
      editor.closeSession();
      return;
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown WASM error";
    const errorId =
      message && typeof message === "object" && "id" in message
        ? String((message as { id: string }).id)
        : "init";
    post({
      type: "error",
      id: errorId,
      message: errorMessage,
    });
    activeRequestId = null;
  }
};

export {};
