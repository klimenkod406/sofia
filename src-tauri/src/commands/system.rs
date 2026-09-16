//! System commands

use crate::services::AppState;
use tauri::{State, command};
use anyhow::Result;

#[command]
pub async fn get_system_info(
    state: State<'_, AppState>,
) -> Result<crate::services::system::SystemInfo, String> {
    state.system.get_system_info()
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn check_updates(
    state: State<'_, AppState>,
) -> Result<crate::services::system::UpdateInfo, String> {
    state.system.check_updates()
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn install_update(
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.system.install_update()
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn open_external(
    state: State<'_, AppState>,
    url: String,
) -> Result<(), String> {
    state.system.open_external(&url)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_app_info(
    state: State<'_, AppState>,
) -> Result<crate::services::system::AppInfo, String> {
    Ok(state.system.get_app_info().await)
}