//! Typed errors at pipeline boundaries (WASM maps these to strings).

use thiserror::Error;

#[derive(Debug, Error)]
pub enum ParseError {
    #[error("Parse cancelled")]
    Cancelled,
    #[error("Ingest failed: {0}")]
    Ingest(String),
    #[error("Pipeline failed at stage {stage}: {message}")]
    Stage {
        stage: &'static str,
        message: String,
    },
}

impl ParseError {
    pub fn into_message(self) -> String {
        self.to_string()
    }
}
