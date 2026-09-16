//! AI Service - coordinates transcription, analysis, and chat

pub use crate::ai::transcription::{TranscriptionResult, TranscriptionSegment};
use crate::ai::{AnalysisEngine, ModelManager, TranscriptionEngine};
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

        Ok(Self {
            transcription,
            analysis,
            models,
            transcription_repo,
            chat_repo,
            models_repo,
        })
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
        self.models_repo.list(model_type, None, true).await
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
