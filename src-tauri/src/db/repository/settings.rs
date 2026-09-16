//! Settings repository

use crate::db::models::*;
use crate::db::sql::{Sql, Value};
use anyhow::Result;
use chrono::{DateTime, Utc};
use std::collections::HashMap;

pub struct SettingsRepository {
    db: Sql,
}

impl SettingsRepository {
    pub fn new(db: Sql) -> Self {
        Self { db }
    }

    pub async fn get(&self, key: &str) -> Result<Option<String>> {
        let rows = self.db.select_with_params(
            "SELECT value FROM settings WHERE key = ?",
            vec![Value::Text(key.to_string())],
        ).await?;

        Ok(rows.into_iter().next().and_then(|row| row.get("value")?.as_str().map(|s| s.to_string())))
    }

    pub async fn get_typed<T: serde::de::DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        let value = self.get(key).await?;
        Ok(value.and_then(|v| serde_json::from_str(&v).ok()))
    }

    pub async fn set(&self, key: &str, value: &str, type_: &str, description: &str) -> Result<()> {
        self.db.execute_with_params(
            r#"
            INSERT INTO settings (key, value, type, description, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                type = excluded.type,
                description = excluded.description,
                updated_at = excluded.updated_at
            "#,
            vec![
                Value::Text(key.to_string()),
                Value::Text(value.to_string()),
                Value::Text(type_.to_string()),
                Value::Text(description.to_string()),
                Value::Text(Utc::now().to_rfc3339()),
            ],
        ).await?;
        Ok(())
    }

    pub async fn set_typed<T: serde::Serialize>(&self, key: &str, value: &T, type_: &str, description: &str) -> Result<()> {
        let json = serde_json::to_string(value)?;
        self.set(key, &json, type_, description).await
    }

    pub async fn delete(&self, key: &str) -> Result<()> {
        self.db.execute_with_params(
            "DELETE FROM settings WHERE key = ?",
            vec![Value::Text(key.to_string())],
        ).await?;
        Ok(())
    }

    pub async fn get_all(&self) -> Result<HashMap<String, String>> {
        let rows = self.db.select("SELECT key, value FROM settings").await?;
        let mut map = HashMap::new();
        for row in rows {
            if let (Some(key), Some(value)) = (row.get("key"), row.get("value")) {
                map.insert(key.as_str().unwrap().to_string(), value.as_str().unwrap().to_string());
            }
        }
        Ok(map)
    }

    pub async fn get_all_typed(&self) -> Result<HashMap<String, serde_json::Value>> {
        let rows = self.db.select("SELECT key, value, type FROM settings").await?;
        let mut map = HashMap::new();
        for row in rows {
            if let (Some(key), Some(value)) = (row.get("key"), row.get("value")) {
                let parsed: serde_json::Value = serde_json::from_str(value.as_str().unwrap_or("null")).unwrap_or(serde_json::Value::Null);
                map.insert(key.as_str().unwrap().to_string(), parsed);
            }
        }
        Ok(map)
    }

    pub async fn get_theme(&self) -> Result<String> {
        self.get("theme").await?.map_or(Ok("system".to_string()), Ok)
    }

    pub async fn set_theme(&self, theme: &str) -> Result<()> {
        self.set("theme", theme, "string", "UI theme").await
    }

    pub async fn get_font_settings(&self) -> Result<FontSettings> {
        let family = self.get_typed("font_family").await?.unwrap_or_else(|| "Inter".to_string());
        let size = self.get_typed("font_size").await?.unwrap_or(14);
        let line_height = self.get_typed("line_height").await?.unwrap_or(1.6);
        
        Ok(FontSettings {
            family,
            size,
            line_height,
        })
    }

    pub async fn set_font_settings(&self, settings: &FontSettings) -> Result<()> {
        self.set_typed("font_family", &settings.family, "string", "Font family").await?;
        self.set_typed("font_size", &settings.size, "number", "Font size").await?;
        self.set_typed("line_height", &settings.line_height, "number", "Line height").await?;
        Ok(())
    }

    pub async fn get_editor_settings(&self) -> Result<EditorSettings> {
        Ok(EditorSettings {
            mode: self.get_typed("editor_mode").await?.unwrap_or_else(|| "wysiwyg".to_string()),
            auto_save: self.get_typed("auto_save").await?.unwrap_or(true),
            auto_save_interval: self.get_typed("auto_save_interval").await?.unwrap_or(2000),
            spell_check: self.get_typed("spell_check").await?.unwrap_or(true),
            show_line_numbers: self.get_typed("show_line_numbers").await?.unwrap_or(false),
            vim_mode: self.get_typed("vim_mode").await?.unwrap_or(false),
        })
    }

    pub async fn set_editor_settings(&self, settings: &EditorSettings) -> Result<()> {
        self.set_typed("editor_mode", &settings.mode, "string", "Editor mode").await?;
        self.set_typed("auto_save", &settings.auto_save, "boolean", "Auto save").await?;
        self.set_typed("auto_save_interval", &settings.auto_save_interval, "number", "Auto save interval").await?;
        self.set_typed("spell_check", &settings.spell_check, "boolean", "Spell check").await?;
        self.set_typed("show_line_numbers", &settings.show_line_numbers, "boolean", "Show line numbers").await?;
        self.set_typed("vim_mode", &settings.vim_mode, "boolean", "Vim mode").await?;
        Ok(())
    }

    pub async fn get_ai_settings(&self) -> Result<AISettings> {
        Ok(AISettings {
            transcription_language: self.get_typed("transcription_language").await?.unwrap_or_else(|| "auto".to_string()),
            transcription_model: self.get_typed("transcription_model").await?.unwrap_or_else(|| "funasr".to_string()),
            analysis_model: self.get_typed("analysis_model").await?.unwrap_or_else(|| "local".to_string()),
            api_provider: self.get_typed("api_provider").await?.unwrap_or_else(|| "openai".to_string()),
        })
    }

    pub async fn set_ai_settings(&self, settings: &AISettings) -> Result<()> {
        self.set_typed("transcription_language", &settings.transcription_language, "string", "Transcription language").await?;
        self.set_typed("transcription_model", &settings.transcription_model, "string", "Transcription model").await?;
        self.set_typed("analysis_model", &settings.analysis_model, "string", "Analysis model").await?;
        self.set_typed("api_provider", &settings.api_provider, "string", "API provider").await?;
        Ok(())
    }

    pub async fn get_ui_preferences(&self) -> Result<UIPreferences> {
        Ok(UIPreferences {
            sidebar_collapsed: self.get_typed("sidebar_collapsed").await?.unwrap_or(false),
            editor_layout: self.get_typed("editor_layout").await?.unwrap_or_else(|| "single".to_string()),
            show_word_count: self.get_typed("show_word_count").await?.unwrap_or(true),
            show_reading_time: self.get_typed("show_reading_time").await?.unwrap_or(true),
        })
    }

    pub async fn set_ui_preferences(&self, prefs: &UIPreferences) -> Result<()> {
        self.set_typed("sidebar_collapsed", &prefs.sidebar_collapsed, "boolean", "Sidebar collapsed").await?;
        self.set_typed("editor_layout", &prefs.editor_layout, "string", "Editor layout").await?;
        self.set_typed("show_word_count", &prefs.show_word_count, "boolean", "Show word count").await?;
        self.set_typed("show_reading_time", &prefs.show_reading_time, "boolean", "Show reading time").await?;
        Ok(())
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FontSettings {
    pub family: String,
    pub size: u32,
    pub line_height: f32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EditorSettings {
    pub mode: String,
    pub auto_save: bool,
    pub auto_save_interval: u32,
    pub spell_check: bool,
    pub show_line_numbers: bool,
    pub vim_mode: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AISettings {
    pub transcription_language: String,
    pub transcription_model: String,
    pub analysis_model: String,
    pub api_provider: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UIPreferences {
    pub sidebar_collapsed: bool,
    pub editor_layout: String,
    pub show_word_count: bool,
    pub show_reading_time: bool,
}