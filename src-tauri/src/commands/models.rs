//! Model management commands

use crate::services::AppState;
use tauri::{State, command};
use anyhow::Result;

#[command]
pub async fn list_local_models(
    state: State<'_, AppState>,
    model_type: Option<String>,
    source: Option<String>,
) -> Result<Vec<crate::db::models::AIModel>, String> {
    state.ai.list_models(model_type.as_deref(), source.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_model_info(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<Option<crate::db::repository::models::ModelInfo>, String> {
    state.ai.get_model_info(&model_id)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn install_model(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), String> {
    state.ai.download_model(&model_id, None)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn uninstall_model(
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), String> {
    state.ai.delete_model(&model_id)
        .await
        .map_err(|e| e.to_string())
}