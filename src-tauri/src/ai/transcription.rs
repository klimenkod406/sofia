//! Transcription engine: selects the active backend per model and runs it.

use crate::ai::funasr::{FunASRTranscriber, WhisperCppTranscriber};
use crate::ai::models::ModelManager;
use crate::db::models::AIModel;
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;

pub use crate::db::models::TranscriptionJob;

/// A single transcribed segment.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TranscriptionSegment {
    pub start: f32,
    pub end: f32,
    pub text: String,
    pub speaker: Option<String>,
    pub confidence: f32,
}

/// Full transcription result.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TranscriptionResult {
    pub text: String,
    pub segments: Vec<TranscriptionSegment>,
    pub duration: f32,
    pub language: String,
}

/// Which concrete engine a model is configured to use.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Backend {
    WhisperCpp,
    FunAsr,
    Api,
    /// No usable local backend could be inferred.
    None,
}

/// Infer the backend from the model's `config.backend` field, falling back to
/// id heuristics so an explicit backend is optional.
pub fn backend_from_model(model: &AIModel) -> Backend {
    if model.source == "api" {
        return Backend::Api;
    }
    let parsed: Option<serde_json::Value> = serde_json::from_str(&model.config).ok();
    let backend = parsed
        .as_ref()
        .and_then(|c| c.get("backend"))
        .and_then(|b| b.as_str())
        .unwrap_or("");
    let mid = model.model_id.as_deref().unwrap_or("").to_ascii_lowercase();

    match backend {
        "whisper_cpp" => Backend::WhisperCpp,
        "funasr" => Backend::FunAsr,
        _ => {
            if mid.contains("funasr") || mid.contains("paraformer") || mid.contains("iic/") {
                Backend::FunAsr
            } else if mid.contains("ggml") || mid.contains("gguf") || mid.contains("whisper") {
                Backend::WhisperCpp
            } else {
                Backend::None
            }
        }
    }
}

pub struct TranscriptionEngine {
    models: Arc<ModelManager>,
    funasr: Option<FunASRTranscriber>,
    whisper: Option<WhisperCppTranscriber>,
    current_model: RwLock<Option<String>>,
}

impl TranscriptionEngine {
    pub fn new(models: Arc<ModelManager>) -> Result<Self> {
        let funasr = FunASRTranscriber::new(&models.get_models_dir().to_string_lossy()).ok();
        let whisper = WhisperCppTranscriber::new().ok();

        Ok(Self {
            models,
            funasr,
            whisper,
            current_model: RwLock::new(None),
        })
    }

    pub async fn transcribe(&self, job: &TranscriptionJob) -> Result<TranscriptionResult> {
        let model_id = job.model_id.as_deref().unwrap_or("funasr-zh-en");
        let model = self.models.get_model(model_id).await?;
        *self.current_model.write().await = Some(model_id.to_string());
        self.transcribe_with_model(&model, &job.audio_path, &job.language)
            .await
    }

    /// Transcribe an audio file using the backend configured on `model`.
    /// This is the single dispatch point shared by file transcription and the
    /// live (chunked) pipeline.
    pub async fn transcribe_with_model(
        &self,
        model: &AIModel,
        audio_path: &str,
        language: &str,
    ) -> Result<TranscriptionResult> {
        match backend_from_model(model) {
            Backend::Api => self.transcribe_api(audio_path, language, model).await,
            Backend::WhisperCpp => {
                let whisper = self.whisper.as_ref().ok_or_else(|| {
                    anyhow::anyhow!("whisper.cpp not available (whisper-cli not found on PATH)")
                })?;
                whisper.transcribe(model, audio_path, language).await
            }
            Backend::FunAsr => {
                let funasr = self.funasr.as_ref().ok_or_else(|| {
                    anyhow::anyhow!("FunASR not available (Python not found)")
                })?;
                funasr.transcribe_with_model(model, audio_path, language).await
            }
            Backend::None => Err(anyhow::anyhow!(
                "No usable backend for model '{}'. Set config.backend to 'whisper_cpp' or 'funasr', or use an API model.",
                model.id
            )),
        }
    }

    pub async fn transcribe_stream(
        &self,
        job: &TranscriptionJob,
        sender: tokio::sync::mpsc::Sender<TranscriptionSegment>,
    ) -> Result<()> {
        let model_id = job.model_id.as_deref().unwrap_or("funasr-zh-en");
        let model = self.models.get_model(model_id).await?;
        *self.current_model.write().await = Some(model_id.to_string());

        if backend_from_model(&model) == Backend::FunAsr {
            if let Some(funasr) = &self.funasr {
                return funasr.transcribe_stream(job, sender).await;
            }
        }

        Err(anyhow::anyhow!("Streaming not supported for this model"))
    }

    async fn transcribe_api(
        &self,
        audio_path: &str,
        language: &str,
        model: &AIModel,
    ) -> Result<TranscriptionResult> {
        // A custom route is just an API model whose `api_endpoint` points at the
        // user's own service; the protocol is OpenAI's `/audio/transcriptions`.
        let api_endpoint = model
            .api_endpoint
            .as_deref()
            .unwrap_or("https://api.openai.com/v1");
        let api_key = self.models.get_decrypted_api_key(&model.id).await?;

        let client = reqwest::Client::new();
        let audio_data = tokio::fs::read(audio_path).await?;

        let model_name = model
            .model_id
            .clone()
            .unwrap_or_else(|| "whisper-1".to_string());
        let lang = if language == "auto" || language.is_empty() {
            String::new()
        } else {
            language.to_string()
        };

        // API endpoints differ: OpenAI uses "/audio/transcriptions", while some
        // self-hosted routes expose a bare URL. Respect a full path if given.
        let endpoint = if api_endpoint.ends_with("/audio/transcriptions")
            || api_endpoint.contains("/audio/transcriptions")
        {
            api_endpoint.to_string()
        } else if api_endpoint.ends_with('/') {
            format!("{}audio/transcriptions", api_endpoint)
        } else {
            format!("{}/audio/transcriptions", api_endpoint)
        };

        let mut form = reqwest::multipart::Form::new()
            .part(
                "file",
                reqwest::multipart::Part::bytes(audio_data).file_name("audio.wav"),
            )
            .text("model", model_name)
            .text("response_format", "verbose_json");
        if !lang.is_empty() {
            form = form.text("language", lang);
        }

        let mut req = client.post(endpoint).multipart(form);
        if !api_key.is_empty() {
            req = req.bearer_auth(api_key);
        }

        let response = req.send().await?;

        if !response.status().is_success() {
            let error = response.text().await?;
            return Err(anyhow::anyhow!("API transcription failed: {error}"));
        }

        #[derive(serde::Deserialize)]
        struct APIResponse {
            text: String,
            segments: Option<Vec<APISegment>>,
            duration: Option<f32>,
            language: Option<String>,
        }

        #[derive(serde::Deserialize)]
        struct APISegment {
            #[serde(default)]
            start: f32,
            #[serde(default)]
            end: f32,
            text: String,
        }

        let api_response: APIResponse = response.json().await?;

        let segments: Vec<TranscriptionSegment> = api_response
            .segments
            .unwrap_or_default()
            .into_iter()
            .map(|s| TranscriptionSegment {
                start: s.start,
                end: s.end,
                text: s.text,
                speaker: None,
                confidence: 1.0,
            })
            .collect();

        // The API segments may omit timing; derive a single whole-duration
        // segment so the logical-segmentation pass still has something to group.
        let segments = if segments.is_empty() && !api_response.text.is_empty() {
            vec![TranscriptionSegment {
                start: 0.0,
                end: api_response.duration.unwrap_or(0.0),
                text: api_response.text.trim().to_string(),
                speaker: None,
                confidence: 1.0,
            }]
        } else {
            segments
        };

        Ok(TranscriptionResult {
            text: api_response.text,
            segments,
            duration: api_response.duration.unwrap_or(0.0),
            language: api_response.language.unwrap_or_else(|| "auto".to_string()),
        })
    }

    pub async fn get_supported_languages(&self) -> Vec<String> {
        vec![
            "auto".to_string(),
            "zh".to_string(),
            "en".to_string(),
            "ja".to_string(),
            "ko".to_string(),
            "fr".to_string(),
            "de".to_string(),
            "es".to_string(),
            "ru".to_string(),
        ]
    }
}
