//! Transcription engine

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

pub struct TranscriptionEngine {
    models: Arc<ModelManager>,
    funasr: Option<FunASRTranscriber>,
    whisper: Option<WhisperCppTranscriber>,
    current_model: RwLock<Option<String>>,
}

impl TranscriptionEngine {
    pub fn new(models: Arc<ModelManager>) -> Result<Self> {
        // Initialize FunASR if available
        let funasr = FunASRTranscriber::new(&models.get_models_dir().to_string_lossy()).ok();

        // Initialize whisper.cpp as fallback
        let whisper =
            WhisperCppTranscriber::new(&models.get_model_path("ggml-base.bin").to_string_lossy())
                .ok();

        Ok(Self {
            models,
            funasr,
            whisper,
            current_model: RwLock::new(None),
        })
    }

    pub async fn transcribe(
        &self,
        job: &crate::db::models::TranscriptionJob,
    ) -> Result<crate::ai::transcription::TranscriptionResult> {
        // Get model to use
        let model_id = job.model_id.as_deref().unwrap_or("funasr-zh-en");
        let model = self.models.get_model(model_id).await?;

        // Update current model
        *self.current_model.write().await = Some(model_id.to_string());

        // Try FunASR first for Chinese/English
        if let Some(funasr) = &self.funasr {
            if model.source == "local" && (model.model_type == "transcription") {
                return funasr.transcribe(job).await;
            }
        }

        // Fallback to whisper.cpp
        if let Some(whisper) = &self.whisper {
            return whisper.transcribe(&job.audio_path, &job.language).await;
        }

        // Fallback to API
        if model.source == "api" {
            return self.transcribe_api(job, &model).await;
        }

        Err(anyhow::anyhow!("No transcription engine available"))
    }

    pub async fn transcribe_stream(
        &self,
        job: &crate::db::models::TranscriptionJob,
        sender: tokio::sync::mpsc::Sender<crate::ai::transcription::TranscriptionSegment>,
    ) -> Result<()> {
        let model_id = job.model_id.as_deref().unwrap_or("funasr-zh-en");
        let model = self.models.get_model(model_id).await?;

        *self.current_model.write().await = Some(model_id.to_string());

        if let Some(funasr) = &self.funasr {
            if model.source == "local" {
                return funasr.transcribe_stream(job, sender).await;
            }
        }

        // For streaming with other engines, we'd need to implement chunked processing
        Err(anyhow::anyhow!("Streaming not supported for this model"))
    }

    async fn transcribe_api(
        &self,
        job: &crate::db::models::TranscriptionJob,
        model: &AIModel,
    ) -> Result<crate::ai::transcription::TranscriptionResult> {
        // Use OpenAI Whisper API or other transcription APIs
        let api_endpoint = model
            .api_endpoint
            .as_deref()
            .unwrap_or("https://api.openai.com/v1");
        let api_key = self.models.get_decrypted_api_key(&model.id).await?;

        let client = reqwest::Client::new();
        let audio_data = tokio::fs::read(&job.audio_path).await?;

        let model_name = model
            .model_id
            .clone()
            .unwrap_or_else(|| "whisper-1".to_string());
        let lang = if job.language == "auto" {
            String::new()
        } else {
            job.language.clone()
        };
        let endpoint = format!("{}/audio/transcriptions", api_endpoint);

        let form = reqwest::multipart::Form::new()
            .part(
                "file",
                reqwest::multipart::Part::bytes(audio_data).file_name("audio.wav"),
            )
            .text("model", model_name)
            .text("language", lang)
            .text("response_format", "verbose_json");

        let response = client
            .post(endpoint)
            .bearer_auth(api_key)
            .multipart(form)
            .send()
            .await?;

        if !response.status().is_success() {
            let error = response.text().await?;
            return Err(anyhow::anyhow!("API transcription failed: {}", error));
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
            start: f32,
            end: f32,
            text: String,
        }

        let api_response: APIResponse = response.json().await?;

        let segments = api_response
            .segments
            .unwrap_or_default()
            .into_iter()
            .map(|s| crate::ai::transcription::TranscriptionSegment {
                start: s.start,
                end: s.end,
                text: s.text,
                speaker: None,
                confidence: 1.0,
            })
            .collect();

        Ok(crate::ai::transcription::TranscriptionResult {
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
