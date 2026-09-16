//! AI module for Σόφια

pub mod analysis;
pub mod funasr;
pub mod llama_cpp;
pub mod models;
pub mod transcription;

pub use analysis::AnalysisEngine;
pub use models::ModelManager;
pub use transcription::TranscriptionEngine;
