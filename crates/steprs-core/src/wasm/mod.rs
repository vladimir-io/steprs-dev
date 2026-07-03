use wasm_bindgen::prelude::*;

mod wire;

use crate::pipeline::{run_pipeline, ParseOptions, PipelineState};

#[wasm_bindgen]
pub struct StepParser {
    state: PipelineState,
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

#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}
