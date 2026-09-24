//! AI Service - coordinates transcription, analysis, and chat

pub use crate::ai::transcription::{TranscriptionResult, TranscriptionSegment};
use crate::ai::{AnalysisEngine, LiveTranscriptionManager, ModelManager, TranscriptionEngine};
use crate::db::models::*;
use crate::db::repository::{AIChatRepository, ModelsRepository, TranscriptionRepository};
use crate::db::Database;
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::mpsc;

pub struct AIService {
    transcription: Arc<TranscriptionEngine>,
    analysis: Arc<AnalysisEngine>,
    models: Arc<ModelManager>,
    pub live: LiveTranscriptionManager,
    transcription_repo: TranscriptionRepository,
    chat_repo: AIChatRepository,
    models_repo: ModelsRepository,
}

impl AIService {
    pub fn new(db: Arc<Database>) -> Result<Self> {
        let models_repo = db.models();
        let transcription_repo = db.transcription();
        let chat_repo = db.ai_chat();

        let models = Arc::new(ModelManager::new(db.models())?);
        let transcription = Arc::new(TranscriptionEngine::new(models.clone())?);
        let analysis = Arc::new(AnalysisEngine::new(models.clone())?);
        let live = LiveTranscriptionManager::new(transcription.clone());

        Ok(Self {
            transcription,
            analysis,
            models,
            live,
            transcription_repo,
            chat_repo,
            models_repo,
        })
    }

    /// Resolve the transcription model to use: an explicit id wins, otherwise
    /// the configured default transcription model.
    pub async fn resolve_transcription_model(&self, model_id: Option<&str>) -> Result<AIModel> {
        match model_id {
            Some(id) => self.models.get_model(id).await,
            None => self
                .models_repo
                .get_default_transcription()
                .await?
                .ok_or_else(|| anyhow::anyhow!("No default transcription model configured")),
        }
    }

    /// Hardware profile used to pick / recommend a local model.
    pub fn device_profile(&self) -> crate::ai::device_profile::DeviceProfile {
        crate::ai::device_profile::DeviceProfile::assess()
    }

    pub async fn recommend_transcription_model(
        &self,
    ) -> Result<crate::ai::device_profile::ModelRecommendation> {
        let profile = self.device_profile();
        let models = self
            .models_repo
            .list(Some("transcription"), None, true)
            .await?;
        crate::ai::device_profile::recommend_transcription_model(&profile, &models)
            .ok_or_else(|| anyhow::anyhow!("No active transcription models available"))
    }

    /// Create or update a user-configured transcription API model ("own API
    /// route"). API models are always `is_downloaded` — no local weights — and
    /// point at the user's own service via `api_endpoint`.
    pub async fn save_custom_api_model(
        &self,
        id: Option<&str>,
        name: &str,
        api_endpoint: &str,
        model_name: &str,
    ) -> Result<AIModel> {
        let existing = match id {
            Some(id) => self.models_repo.get(id).await?,
            None => None,
        };
        let is_new = existing.is_none();
        let now = chrono::Utc::now();

        let mut model = existing.unwrap_or(AIModel {
            id: uuid::Uuid::new_v4().to_string(),
            name: String::new(),
            model_type: "transcription".to_string(),
            source: "api".to_string(),
            model_id: None,
            api_endpoint: None,
            api_key_encrypted: None,
            local_path: None,
            huggingface_repo: None,
            huggingface_revision: None,
            tokenizer_path: None,
            config_path: None,
            size_bytes: 0,
            quantization: None,
            languages: "[]".to_string(),
            capabilities: "[]".to_string(),
            config: "{}".to_string(),
            min_ram_gb: 0,
            recommended_ram_gb: 0,
            supports_gpu: false,
            supports_cpu: true,
            max_context_length: 0,
            sample_rate: 16000,
            chunk_duration_seconds: 30.0,
            overlap_duration_seconds: 2.0,
            is_active: true,
            is_downloaded: true,
            download_progress: 1.0,
            last_used_at: None,
            created_at: now,
            updated_at: now,
        });

        model.name = name.to_string();
        model.api_endpoint = Some(api_endpoint.to_string());
        model.model_id = Some(model_name.to_string());
        model.config = "{\"backend\":\"api\",\"rft_cpu\":0.0}".to_string();
        model.languages = "[\"zh\",\"en\",\"auto\",\"multilingual\"]".to_string();
        model.capabilities = "[\"transcription\"]".to_string();
        model.is_active = true;
        model.is_downloaded = true;
        model.updated_at = chrono::Utc::now();

        if is_new {
            self.models_repo.create(model).await
        } else {
            self.models_repo.update(&model).await?;
            Ok(model)
        }
    }

    // Transcription
    pub async fn transcribe_audio(
        &self,
        audio_path: &str,
        model_id: Option<&str>,
        language: &str,
    ) -> Result<TranscriptionResult> {
        // Create job
        let job = TranscriptionJob {
            id: String::new(),
            audio_path: audio_path.to_string(),
            model_id: model_id.map(|s| s.to_string()),
            language: language.to_string(),
            status: "pending".to_string(),
            progress: 0.0,
            result_text: String::new(),
            result_segments: "[]".to_string(),
            error_message: None,
            duration_seconds: 0.0,
            created_at: chrono::Utc::now(),
            completed_at: None,
        };

        let job = self.transcription_repo.create_job(job).await?;

        // Start transcription
        let result = self.transcription.transcribe(&job).await?;

        // Update job with result
        self.transcription_repo
            .complete_job(
                &job.id,
                &result.text,
                &serde_json::to_string(&result.segments)?,
                result.duration,
            )
            .await?;

        Ok(result)
    }

    pub async fn transcribe_stream(
        &self,
        audio_path: &str,
        model_id: Option<&str>,
        language: &str,
        sender: mpsc::Sender<TranscriptionSegment>,
    ) -> Result<()> {
        let job = TranscriptionJob {
            id: String::new(),
            audio_path: audio_path.to_string(),
            model_id: model_id.map(|s| s.to_string()),
            language: language.to_string(),
            status: "pending".to_string(),
            progress: 0.0,
            result_text: String::new(),
            result_segments: "[]".to_string(),
            error_message: None,
            duration_seconds: 0.0,
            created_at: chrono::Utc::now(),
            completed_at: None,
        };

        let job = self.transcription_repo.create_job(job).await?;
        self.transcription.transcribe_stream(&job, sender).await
    }

    pub async fn get_transcription_jobs(
        &self,
        status: Option<&str>,
        limit: i32,
    ) -> Result<Vec<TranscriptionJob>> {
        self.transcription_repo.list_jobs(status, limit).await
    }

    pub async fn cancel_transcription(&self, job_id: &str) -> Result<()> {
        self.transcription_repo.cancel_job(job_id).await
    }

    // Analysis
    pub async fn analyze_text(
        &self,
        text: &str,
        analysis_type: AnalysisType,
        model_id: Option<&str>,
    ) -> Result<AnalysisResult> {
        self.analysis.analyze(text, analysis_type, model_id).await
    }

    pub async fn chat_completion(
        &self,
        messages: Vec<ChatMessage>,
        model_id: Option<&str>,
        options: ChatOptions,
    ) -> Result<ChatCompletion> {
        self.analysis.chat(messages, model_id, options).await
    }

    // Model management
    pub async fn get_available_models(&self, model_type: Option<&str>) -> Result<Vec<AIModel>> {
        let mut models = self.models_repo.list(model_type, None, true).await?;
        // Only models that can actually run: local weights must be downloaded,
        // API models are always ready.
        models.retain(|m| m.source == "api" || m.is_downloaded);
        Ok(models)
    }

    pub async fn download_model(
        &self,
        model_id: &str,
        progress_callback: Option<Box<dyn Fn(f32) + Send + Sync>>,
    ) -> Result<()> {
        self.models
            .download_model(model_id, progress_callback)
            .await
    }

    pub async fn delete_model(&self, model_id: &str) -> Result<()> {
        self.models.delete_model(model_id).await
    }

    pub async fn set_api_key(&self, model_id: &str, api_key: &str) -> Result<()> {
        self.models.set_api_key(model_id, api_key).await
    }

    pub async fn test_api_connection(&self, model_id: &str) -> Result<bool> {
        self.models.test_connection(model_id).await
    }

    /// Current download state for a model (None if not downloading).
    pub async fn get_download_state(
        &self,
        model_id: &str,
    ) -> Option<crate::ai::models::DownloadState> {
        self.models.get_download_state(model_id).await
    }

    // Chat sessions
    pub async fn create_chat(
        &self,
        note_id: Option<&str>,
        model_id: Option<&str>,
    ) -> Result<AIChat> {
        let chat = AIChat {
            id: String::new(),
            note_id: note_id.map(|s| s.to_string()),
            title: "New Chat".to_string(),
            model_id: model_id.map(|s| s.to_string()),
            system_prompt: String::new(),
            temperature: 0.7,
            max_tokens: 4096,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        self.chat_repo.create_chat(chat).await
    }

    pub async fn get_chat(&self, id: &str) -> Result<Option<AIChat>> {
        self.chat_repo.get_chat(id).await
    }

    pub async fn get_chats_for_note(&self, note_id: &str) -> Result<Vec<AIChat>> {
        self.chat_repo.get_chats_for_note(note_id).await
    }

    pub async fn add_message(&self, chat_id: &str, role: &str, content: &str) -> Result<AIMessage> {
        let message = AIMessage {
            id: String::new(),
            chat_id: chat_id.to_string(),
            role: role.to_string(),
            content: content.to_string(),
            tool_calls: None,
            tool_call_id: None,
            tokens_used: 0,
            created_at: chrono::Utc::now(),
        };
        self.chat_repo.add_message(message).await
    }

    pub async fn get_messages(&self, chat_id: &str, limit: Option<i32>) -> Result<Vec<AIMessage>> {
        self.chat_repo.get_messages(chat_id, limit, None).await
    }

    pub async fn list_models(
        &self,
        model_type: Option<&str>,
        source: Option<&str>,
    ) -> Result<Vec<AIModel>> {
        self.models_repo.list(model_type, source, true).await
    }

    pub async fn get_model_info(
        &self,
        model_id: &str,
    ) -> Result<Option<crate::db::repository::models::ModelInfo>> {
        self.models_repo.get_model_info(model_id).await
    }

    pub async fn update_chat_model(&self, chat_id: &str, model_id: &str) -> Result<()> {
        if let Some(mut chat) = self.chat_repo.get_chat(chat_id).await? {
            chat.model_id = Some(model_id.to_string());
            chat.updated_at = chrono::Utc::now();
            self.chat_repo.update_chat(&chat).await?;
        }
        Ok(())
    }

    pub async fn clear_chat_messages(&self, chat_id: &str) -> Result<()> {
        self.chat_repo.clear_chat_messages(chat_id).await
    }

    pub async fn create_transcription_job(
        &self,
        job: TranscriptionJob,
    ) -> Result<TranscriptionJob> {
        self.transcription_repo.create_job(job).await
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type")]
pub enum AnalysisType {
    Summarize,
    Correct,
    Improve,
    Translate { target_language: String },
    ExtractKeyPoints,
    ExtractActionItems,
    AnalyzeSentiment,
    GenerateTags,
    Custom { prompt: String },
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AnalysisResult {
    pub result: String,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ChatOptions {
    pub temperature: f32,
    pub max_tokens: i32,
    pub top_p: f32,
    pub stream: bool,
}

impl Default for ChatOptions {
    fn default() -> Self {
        Self {
            temperature: 0.7,
            max_tokens: 4096,
            top_p: 0.9,
            stream: false,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ChatCompletion {
    pub message: ChatMessage,
    pub tokens_used: i32,
    pub model: String,
}
