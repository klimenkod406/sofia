//! Model management commands

use crate::services::AppState;
use anyhow::Result;
use tauri::{command, State};

#[command]
pub async fn list_local_models(
    state: State<'_, AppState>,
    model_type: Option<String>,
    source: Option<String>,
) -> Result<Vec<crate::db::models::AIModel>, String> {
    state
        .ai
        .list_models(model_type.as_deref(), source.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_model_info(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<Option<crate::db::repository::models::ModelInfo>, String> {
    state
        .ai
        .get_model_info(&model_id)
        .await
        .map_err(|e| e.to_string())
}

/// Start downloading a model in the background and return immediately. The
/// frontend polls `get_download_progress` until the state reaches
/// `completed`/`failed`, so navigating away from Settings neither blocks the
/// UI nor cancels the download (progress also lands in the DB row).
#[command]
pub async fn install_model(state: State<'_, AppState>, model_id: String) -> Result<(), String> {
    let ai = state.ai.clone();
    // JoinHandle отбрасывается явно: задача продолжает выполняться в фоне,
    // а clippy::let_underscore_future не ругается на такой detach.
    drop(tauri::async_runtime::spawn(async move {
        if let Err(e) = ai.download_model(&model_id, None).await {
            tracing::error!("model download failed for {model_id}: {e}");
        }
    }));
    Ok(())
}

/// Live download state for a model (None if nothing is in flight).
#[command]
pub async fn get_download_progress(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<Option<crate::ai::models::DownloadState>, String> {
    Ok(state.ai.get_download_state(&model_id).await)
}

#[command]
pub async fn uninstall_model(state: State<'_, AppState>, model_id: String) -> Result<(), String> {
    state
        .ai
        .delete_model(&model_id)
        .await
        .map_err(|e| e.to_string())
}
