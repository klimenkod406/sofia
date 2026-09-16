//! Tag commands

use crate::services::AppState;
use anyhow::Result;
use tauri::{command, State};

#[command]
pub async fn list_tags(
    state: State<'_, AppState>,
    include_system: Option<bool>,
) -> Result<Vec<crate::db::models::Tag>, String> {
    state
        .tags
        .list_tags(include_system.unwrap_or(true))
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn create_tag(
    state: State<'_, AppState>,
    name: String,
    color: Option<String>,
) -> Result<crate::db::models::Tag, String> {
    state
        .tags
        .create_tag(&name, color.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn delete_tag(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.tags.delete_tag(&id).await.map_err(|e| e.to_string())
}
