//! File operations commands

use crate::services::AppState;
use anyhow::Result;
use serde::Deserialize;
use std::path::PathBuf;
use tauri::{command, State};

#[derive(Deserialize)]
pub struct ReadFileRequest {
    pub path: String,
}

#[derive(Deserialize)]
pub struct WriteFileRequest {
    pub path: String,
    pub content: String,
}

#[derive(Deserialize)]
pub struct ListDirectoryRequest {
    pub path: String,
}

#[derive(Deserialize)]
pub struct CreateDirectoryRequest {
    pub path: String,
}

#[command]
pub async fn read_file(
    state: State<'_, AppState>,
    request: ReadFileRequest,
) -> Result<String, String> {
    state
        .file_ops
        .read_file(PathBuf::from(request.path).as_path())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn write_file(
    state: State<'_, AppState>,
    request: WriteFileRequest,
) -> Result<(), String> {
    state
        .file_ops
        .write_file(PathBuf::from(request.path).as_path(), &request.content)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn delete_file(state: State<'_, AppState>, path: String) -> Result<(), String> {
    state
        .file_ops
        .delete_file(PathBuf::from(path).as_path())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn list_directory(
    state: State<'_, AppState>,
    request: ListDirectoryRequest,
) -> Result<Vec<crate::services::file_ops::FileEntry>, String> {
    state
        .file_ops
        .list_directory(PathBuf::from(request.path).as_path())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn create_directory(
    state: State<'_, AppState>,
    request: CreateDirectoryRequest,
) -> Result<(), String> {
    state
        .file_ops
        .create_directory(PathBuf::from(request.path).as_path())
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_disk_usage(
    state: State<'_, AppState>,
) -> Result<crate::services::file_ops::DiskUsage, String> {
    state
        .file_ops
        .get_disk_usage()
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn clean_temp(state: State<'_, AppState>) -> Result<u64, String> {
    state.file_ops.clean_temp().await.map_err(|e| e.to_string())
}
