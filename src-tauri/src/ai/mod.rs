//! AI module for Σόφια

pub mod analysis;
pub mod device_profile;
pub mod funasr;
pub mod live;
pub mod llama_cpp;
pub mod models;
pub mod segmentation;
pub mod transcription;

pub use analysis::AnalysisEngine;
pub use live::LiveTranscriptionManager;
pub use models::ModelManager;
pub use transcription::TranscriptionEngine;
