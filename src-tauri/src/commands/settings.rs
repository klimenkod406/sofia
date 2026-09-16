//! Settings commands

use crate::services::settings::{AISettings, EditorSettings, FontSettings, UIPreferences};
use crate::services::AppState;
use anyhow::Result;
use serde::Deserialize;
use tauri::{command, State};

#[derive(Deserialize)]
pub struct UpdateSettingsRequest {
    pub theme: Option<String>,
    pub font: Option<FontSettings>,
    pub editor: Option<EditorSettings>,
    pub ai: Option<AISettings>,
    pub ui: Option<UIPreferences>,
}

#[command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    state
        .settings
        .get_all_settings()
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn update_settings(
    state: State<'_, AppState>,
    settings: serde_json::Value,
) -> Result<(), String> {
    // Accept both the nested frontend shape
    // ({theme, font:{family,size,lineHeight}, editor:{mode,autoSave,...},
    //   ai:{...}, ui/uiPreferences:{...}})
    // and a flat snake_case map ({theme, font_family, ...}).
    let get = |keys: &[&str]| -> Option<String> {
        for key in keys {
            if let Some(v) = settings.get(*key) {
                if let Some(s) = v.as_str() {
                    return Some(s.to_string());
                }
                if v.is_number() || v.is_boolean() {
                    return Some(v.to_string());
                }
            }
        }
        None
    };
    let sub = |obj: &str, keys: &[&str]| -> Option<String> {
        let o = settings.get(obj)?;
        for key in keys {
            if let Some(v) = o.get(*key) {
                if let Some(s) = v.as_str() {
                    return Some(s.to_string());
                }
                if v.is_number() || v.is_boolean() {
                    return Some(v.to_string());
                }
            }
        }
        None
    };

    if let Some(theme) = get(&["theme"]) {
        state
            .settings
            .set_theme(&theme)
            .await
            .map_err(|e| e.to_string())?;
    }

    let mut font = state
        .settings
        .get_font_settings()
        .await
        .map_err(|e| e.to_string())?;
    let mut font_changed = false;
    if let Some(v) = sub("font", &["family", "font_family"]).or_else(|| get(&["font_family"])) {
        font.family = v;
        font_changed = true;
    }
    if let Some(v) = sub("font", &["size", "font_size"]).or_else(|| get(&["font_size"])) {
        if let Ok(n) = v.parse::<u32>() {
            font.size = n;
            font_changed = true;
        }
    }
    if let Some(v) = sub("font", &["lineHeight", "line_height"]).or_else(|| get(&["line_height"])) {
        if let Ok(n) = v.parse::<f32>() {
            font.line_height = n;
            font_changed = true;
        }
    }
    if font_changed {
        state
            .settings
            .set_font_settings(&font)
            .await
            .map_err(|e| e.to_string())?;
    }

    let mut editor = state
        .settings
        .get_editor_settings()
        .await
        .map_err(|e| e.to_string())?;
    let mut editor_changed = false;
    if let Some(v) = sub("editor", &["mode", "editor_mode"]).or_else(|| get(&["editor_mode"])) {
        editor.mode = v;
        editor_changed = true;
    }
    let mut set_bool = |cur: &mut bool, v: Option<String>| {
        if let Some(s) = v {
            if let Ok(b) = s.parse::<bool>() {
                *cur = b;
                editor_changed = true;
            }
        }
    };
    set_bool(
        &mut editor.auto_save,
        sub("editor", &["autoSave", "auto_save"]).or_else(|| get(&["auto_save"])),
    );
    set_bool(
        &mut editor.spell_check,
        sub("editor", &["spellCheck", "spell_check"]).or_else(|| get(&["spell_check"])),
    );
    set_bool(
        &mut editor.show_line_numbers,
        sub("editor", &["showLineNumbers", "show_line_numbers"]),
    );
    set_bool(
        &mut editor.vim_mode,
        sub("editor", &["vimMode", "vim_mode"]),
    );
    if let Some(v) = sub("editor", &["autoSaveInterval", "auto_save_interval"]) {
        if let Ok(n) = v.parse::<u32>() {
            editor.auto_save_interval = n;
            editor_changed = true;
        }
    }
    if editor_changed {
        state
            .settings
            .set_editor_settings(&editor)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[command]
pub async fn get_theme(state: State<'_, AppState>) -> Result<String, String> {
    state.settings.get_theme().await.map_err(|e| e.to_string())
}

#[command]
pub async fn set_theme(state: State<'_, AppState>, theme: String) -> Result<(), String> {
    state
        .settings
        .set_theme(&theme)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn get_font_settings(state: State<'_, AppState>) -> Result<FontSettings, String> {
    state
        .settings
        .get_font_settings()
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn set_font_settings(
    state: State<'_, AppState>,
    settings: FontSettings,
) -> Result<(), String> {
    state
        .settings
        .set_font_settings(&settings)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn reset_settings(state: State<'_, AppState>) -> Result<(), String> {
    state
        .settings
        .reset_to_defaults()
        .await
        .map_err(|e| e.to_string())
}
