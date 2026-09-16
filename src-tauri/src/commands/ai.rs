//! AI commands

use crate::services::AppState;
use crate::services::ai::{AnalysisType, ChatMessage, ChatOptions};
use tauri::{State, command};
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct TranscribeRequest {
    pub audio_path: String,
    pub model_id: Option<String>,
    pub language: Option<String>,
}

#[derive(Deserialize)]
pub struct AnalyzeRequest {
    pub text: String,
    pub analysis_type: AnalysisType,
    pub model_id: Option<String>,
}

#[derive(Deserialize)]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
    pub model_id: Option<String>,
    pub options: Option<ChatOptions>,
}

#[derive(Deserialize)]
pub struct CreateChatRequest {
    pub note_id: Option<String>,
    pub model_id: Option<String>,
}

#[command]
pub async fn transcribe_audio(
    state: State<'_, AppState>,
    request: TranscribeRequest,
) -> Result<crate::services::ai::TranscriptionResult, String> {
    state.ai.transcribe_audio(
        &request.audio_path,
        request.model_id.as_deref(),
        request.language.as_deref().unwrap_or("auto"),
    )
    .await
    .map_err(|e| e.to_string())
}

#[command]
pub async fn transcribe_stream(
    state: State<'_, AppState>,
    request: TranscribeRequest,
) -> Result<String, String> {
    // This would return a stream ID for WebSocket or SSE
    // For now, return a job ID
    let job = crate::db::models::TranscriptionJob {
        id: uuid::Uuid::new_v4().to_string(),
        audio_path: request.audio_path,
        model_id: request.model_id,
        language: request.language.unwrap_or_else(|| "auto".to_string()),
        status: "pending".to_string(),
        progress: 0.0,
        result_text: String::new(),
        result_segments: "[]".to_string(),
        error_message: None,
        duration_seconds: 0.0,
        created_at: chrono::Utc::now(),
        completed_at: None,
    };

    let job = state.ai.create_transcription_job(job).await.map_err(|e| e.to_string())?;
    
    // Start transcription in background
    let ai_service = state.ai.clone();
    let job_id = job.id.clone();
    tokio::spawn(async move {
        let _ = ai_service.transcribe_audio(&job.audio_path, job.model_id.as_deref(), &job.language).await;
    });

    Ok(job_id)
}

#[command]
pub async fn analyze_text(
    state: State<'_, AppState>,
    request: AnalyzeRequest,
) -> Result<crate::services::ai::AnalysisResult, String> {
    state.ai.analyze_text(&request.text, request.analysis_type, request.model_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn chat_completion(
    state: State<'_, AppState>,
    messages: Vec<ChatMessage>,
    model_id: Option<String>,
    options: Option<ChatOptions>,
) -> Result<crate::services::ai::ChatCompletion, String> {
    state.ai.chat_completion(messages, model_id.as_deref(), options.unwrap_or_default())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_available_models(
    state: State<'_, AppState>,
    model_type: Option<String>,
) -> Result<Vec<crate::db::models::AIModel>, String> {
    state.ai.get_available_models(model_type.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn download_model(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), String> {
    // This would need progress updates via events
    state.ai.download_model(&model_id, None)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn delete_model(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), String> {
    state.ai.delete_model(&model_id)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn set_api_key(
    state: State<'_, AppState>,
    model_id: String,
    api_key: String,
) -> Result<(), String> {
    state.ai.set_api_key(&model_id, &api_key)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn test_api_connection(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<bool, String> {
    state.ai.test_api_connection(&model_id)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn create_ai_chat(
    state: State<'_, AppState>,
    note_id: Option<String>,
    model_id: Option<String>,
) -> Result<crate::db::models::AIChat, String> {
    state.ai.create_chat(note_id.as_deref(), model_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_ai_chat(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<crate::db::models::AIChat>, String> {
    state.ai.get_chat(&id)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_chats_for_note(
    state: State<'_, AppState>,
    note_id: String,
) -> Result<Vec<crate::db::models::AIChat>, String> {
    state.ai.get_chats_for_note(&note_id)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn add_ai_message(
    state: State<'_, AppState>,
    chat_id: String,
    role: String,
    content: String,
) -> Result<crate::db::models::AIMessage, String> {
    state.ai.add_message(&chat_id, &role, &content)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_ai_messages(
    state: State<'_, AppState>,
    chat_id: String,
    limit: Option<i32>,
) -> Result<Vec<crate::db::models::AIMessage>, String> {
    state.ai.get_messages(&chat_id, limit)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn update_ai_chat(
    state: State<'_, AppState>,
    chat_id: String,
    model_id: String,
) -> Result<(), String> {
    state.ai.update_chat_model(&chat_id, &model_id)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn clear_chat_messages(
    state: State<'_, AppState>,
    chat_id: String,
) -> Result<(), String> {
    state.ai.clear_chat_messages(&chat_id)
        .await
        .map_err(|e| e.to_string())
}