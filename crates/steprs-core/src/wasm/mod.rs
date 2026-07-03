use wasm_bindgen::prelude::*;

mod wire;

use crate::pipeline::{run_pipeline, ParseOptions, PipelineState};

#[cfg(feature = "editor")]
use crate::editor::{apply_edit_ops, export_step, EditOp, StepSession, VerifySpec};

#[wasm_bindgen]
pub struct StepParser {
    state: PipelineState,
    #[cfg(feature = "editor")]
    session: Option<StepSession>,
    progress_handler: Option<js_sys::Function>,
}

impl Default for StepParser {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl StepParser {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            state: PipelineState::new(),
            #[cfg(feature = "editor")]
            session: None,
            progress_handler: None,
        }
    }

    #[wasm_bindgen(js_name = setProgressHandler)]
    pub fn set_progress_handler(&mut self, handler: js_sys::Function) {
        self.progress_handler = Some(handler);
    }

    #[wasm_bindgen(js_name = cancel)]
    pub fn cancel_parse(&self) {
        self.state.cancel();
    }

    #[cfg(feature = "editor")]
    #[wasm_bindgen(js_name = hasSession)]
    pub fn has_session(&self) -> bool {
        self.session.is_some()
    }

    pub fn parse(&mut self, raw_bytes: &[u8]) -> Result<String, JsValue> {
        self.parse_with_options(raw_bytes, true, true)
    }

    #[wasm_bindgen(js_name = parseQuotingOnly)]
    pub fn parse_quoting_only(&mut self, raw_bytes: &[u8]) -> Result<String, JsValue> {
        self.parse_with_options(raw_bytes, false, false)
    }

    #[wasm_bindgen(js_name = parseWithOptions)]
    pub fn parse_with_options(
        &mut self,
        raw_bytes: &[u8],
        include_mesh: bool,
        include_labels: bool,
    ) -> Result<String, JsValue> {
        let generation = self.state.begin_parse();
        let options = ParseOptions {
            include_mesh,
            include_labels,
        };

        let handler = self.progress_handler.as_ref();
        let mut on_stage = |stage: &str| {
            if let Some(h) = handler {
                let _ = h.call1(&JsValue::NULL, &JsValue::from_str(stage));
            }
        };

        let output = run_pipeline(
            raw_bytes,
            options,
            &self.state,
            generation,
            Some(&mut on_stage),
        )
        .map_err(|e| JsValue::from_str(&e))?;

        serde_json::to_string(&output.result).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Metrics JSON + mesh as Float32Array/Uint32Array (no JSON float arrays).
    #[wasm_bindgen(js_name = parseWithOptionsWire)]
    pub fn parse_with_options_wire(
        &mut self,
        raw_bytes: &[u8],
        include_mesh: bool,
        include_labels: bool,
    ) -> Result<JsValue, JsValue> {
        let generation = self.state.begin_parse();
        let options = ParseOptions {
            include_mesh,
            include_labels,
        };

        let handler = self.progress_handler.as_ref();
        let mut on_stage = |stage: &str| {
            if let Some(h) = handler {
                let _ = h.call1(&JsValue::NULL, &JsValue::from_str(stage));
            }
        };

        let output = run_pipeline(
            raw_bytes,
            options,
            &self.state,
            generation,
            Some(&mut on_stage),
        )
        .map_err(|e| JsValue::from_str(&e))?;

        wire::parse_result_wire(output.result)
    }

    #[wasm_bindgen(js_name = getKernelInfo)]
    pub fn get_kernel_info(&self) -> Result<String, JsValue> {
        serde_json::to_string(&crate::kernel::kernel_info())
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}

#[cfg(feature = "editor")]
#[wasm_bindgen]
impl StepParser {
    #[wasm_bindgen(js_name = getParseResultWire)]
    pub fn get_parse_result_wire(&self) -> Result<JsValue, JsValue> {
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No editor session open"))?;
        wire::parse_result_wire(session.parse_result.clone())
    }

    /// Parse and open a persistent editable session (metrics-only by default).
    #[wasm_bindgen(js_name = openSession)]
    pub fn open_session(&mut self, raw_bytes: &[u8]) -> Result<String, JsValue> {
        self.open_session_with_options(raw_bytes, true, false)
    }

    #[wasm_bindgen(js_name = openSessionWithOptions)]
    pub fn open_session_with_options(
        &mut self,
        raw_bytes: &[u8],
        include_mesh: bool,
        include_labels: bool,
    ) -> Result<String, JsValue> {
        let session = StepSession::open(
            raw_bytes.to_vec(),
            ParseOptions {
                include_mesh,
                include_labels,
            },
        )
        .map_err(|e| JsValue::from_str(&e))?;
        let snapshot = session.snapshot();
        self.session = Some(session);
        serde_json::to_string(&snapshot).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = getSnapshot)]
    pub fn get_snapshot(&self) -> Result<String, JsValue> {
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No editor session open"))?;
        serde_json::to_string(&session.snapshot()).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = getParseResult)]
    pub fn get_parse_result(&self) -> Result<String, JsValue> {
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No editor session open"))?;
        serde_json::to_string(&session.parse_result).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = applyEdits)]
    pub fn apply_edits(
        &mut self,
        ops_json: &str,
        verify_json: Option<String>,
    ) -> Result<String, JsValue> {
        let session = self
            .session
            .as_mut()
            .ok_or_else(|| JsValue::from_str("No editor session open"))?;

        let ops: Vec<EditOp> =
            serde_json::from_str(ops_json).map_err(|e| JsValue::from_str(&e.to_string()))?;

        let verify = verify_json
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(serde_json::from_str::<VerifySpec>)
            .transpose()
            .map_err(|e| JsValue::from_str(&e.to_string()))?;

        let result = apply_edit_ops(session, &ops, verify.as_ref());
        serde_json::to_string(&result).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = undo)]
    pub fn undo(&mut self) -> Result<String, JsValue> {
        let session = self
            .session
            .as_mut()
            .ok_or_else(|| JsValue::from_str("No editor session open"))?;

        if !session.undo() {
            return Err(JsValue::from_str("Nothing to undo"));
        }
        session
            .reanalyze(ParseOptions::preview())
            .map_err(|e| JsValue::from_str(&e))?;
        session_state_json(session)
    }

    #[wasm_bindgen(js_name = redo)]
    pub fn redo(&mut self) -> Result<String, JsValue> {
        let session = self
            .session
            .as_mut()
            .ok_or_else(|| JsValue::from_str("No editor session open"))?;

        if !session.redo() {
            return Err(JsValue::from_str("Nothing to redo"));
        }
        session
            .reanalyze(ParseOptions::preview())
            .map_err(|e| JsValue::from_str(&e))?;
        session_state_json(session)
    }

    #[wasm_bindgen(js_name = exportStep)]
    pub fn export_step(&self) -> Result<Vec<u8>, JsValue> {
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No editor session open"))?;
        export_step(session).map_err(|e| JsValue::from_str(&e))
    }

    #[wasm_bindgen(js_name = exportEditTriplet)]
    pub fn export_edit_triplet(
        &self,
        instruction: &str,
        ops_json: &str,
    ) -> Result<String, JsValue> {
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| JsValue::from_str("No editor session open"))?;
        let ops: Vec<EditOp> =
            serde_json::from_str(ops_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        crate::editor::export_edit_triplet(session, instruction, &ops)
            .map_err(|e| JsValue::from_str(&e))
    }

    #[wasm_bindgen(js_name = closeSession)]
    pub fn close_session(&mut self) {
        self.session = None;
    }
}

#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[cfg(feature = "editor")]
#[derive(serde::Serialize)]
struct SessionStateResponse {
    snapshot: crate::editor::ModelSnapshot,
    can_undo: bool,
    can_redo: bool,
}

#[cfg(feature = "editor")]
fn session_state_json(session: &StepSession) -> Result<String, JsValue> {
    let payload = SessionStateResponse {
        snapshot: session.snapshot(),
        can_undo: session.can_undo(),
        can_redo: session.can_redo(),
    };
    serde_json::to_string(&payload).map_err(|e| JsValue::from_str(&e.to_string()))
}
