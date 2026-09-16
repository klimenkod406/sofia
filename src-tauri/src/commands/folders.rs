//! Folder commands

use crate::services::AppState;
use tauri::{State, command};
use anyhow::Result;

#[command]
pub async fn list_folders(
    state: State<'_, AppState>,
    parent_id: Option<String>,
) -> Result<Vec<crate::db::models::Folder>, String> {
    state.folders.list_folders(parent_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn create_folder(
    state: State<'_, AppState>,
    name: String,
    parent_id: Option<String>,
) -> Result<crate::db::models::Folder, String> {
    state.folders.create_folder(&name, parent_id, None, None)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn update_folder(
    state: State<'_, AppState>,
    folder: crate::db::models::Folder,
) -> Result<(), String> {
    state.folders.update_folder(&folder)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn delete_folder(
    state: State<'_, AppState>,
    id: String,
    recursive: Option<bool>,
) -> Result<(), String> {
    state.folders.delete_folder(&id, recursive.unwrap_or(false))
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_folder_tree(
    state: State<'_, AppState>,
) -> Result<Vec<crate::db::models::FolderTree>, String> {
    state.folders.get_folder_tree()
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn move_folder(
    state: State<'_, AppState>,
    id: String,
    parent_id: Option<String>,
) -> Result<(), String> {
    state.folders.move_folder(&id, parent_id.as_deref())
        .await
        .map_err(|e| e.to_string())
}
