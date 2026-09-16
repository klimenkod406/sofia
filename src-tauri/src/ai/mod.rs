//! AI module for Σόφια

pub mod transcription;
pub mod analysis;
pub mod models;
pub mod funasr;
pub mod llama_cpp;

use std::sync::Arc;

pub use transcription::TranscriptionEngine;
pub use analysis::AnalysisEngine;
pub use models::ModelManager;