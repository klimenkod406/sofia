//! Settings service

use crate::db::models::*;
use crate::db::repository::SettingsRepository;
use crate::db::Database;
use anyhow::Result;
use std::sync::Arc;

pub use crate::db::repository::settings::{FontSettings, EditorSettings, AISettings, UIPreferences};

pub struct SettingsService {
    repo: SettingsRepository,
}

impl SettingsService {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            repo: db.settings(),
        }
    }

    pub async fn get_setting(&self, key: &str) -> Result<Option<String>> {
        self.repo.get(key).await
    }

    pub async fn get_setting_typed<T: serde::de::DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        self.repo.get_typed(key).await
    }

    pub async fn set_setting(&self, key: &str, value: &str, type_: &str, description: &str) -> Result<()> {
        self.repo.set(key, value, type_, description).await
    }

    pub async fn set_setting_typed<T: serde::Serialize>(&self, key: &str, value: &T, type_: &str, description: &str) -> Result<()> {
        self.repo.set_typed(key, value, type_, description).await
    }

    pub async fn delete_setting(&self, key: &str) -> Result<()> {
        self.repo.delete(key).await
    }

    pub async fn get_all_settings(&self) -> Result<serde_json::Value> {
        let settings = self.repo.get_all_typed().await?;
        Ok(serde_json::to_value(settings)?)
    }

    // Theme
    pub async fn get_theme(&self) -> Result<String> {
        self.repo.get_theme().await
    }

    pub async fn set_theme(&self, theme: &str) -> Result<()> {
        self.repo.set_theme(theme).await
    }

    // Font settings
    pub async fn get_font_settings(&self) -> Result<FontSettings> {
        self.repo.get_font_settings().await
    }

    pub async fn set_font_settings(&self, settings: &FontSettings) -> Result<()> {
        self.repo.set_font_settings(settings).await
    }

    // Editor settings
    pub async fn get_editor_settings(&self) -> Result<EditorSettings> {
        self.repo.get_editor_settings().await
    }

    pub async fn set_editor_settings(&self, settings: &EditorSettings) -> Result<()> {
        self.repo.set_editor_settings(settings).await
    }

    // AI settings
    pub async fn get_ai_settings(&self) -> Result<AISettings> {
        self.repo.get_ai_settings().await
    }

    pub async fn set_ai_settings(&self, settings: &AISettings) -> Result<()> {
        self.repo.set_ai_settings(settings).await
    }

    // UI preferences
    pub async fn get_ui_preferences(&self) -> Result<UIPreferences> {
        self.repo.get_ui_preferences().await
    }

    pub async fn set_ui_preferences(&self, prefs: &UIPreferences) -> Result<()> {
        self.repo.set_ui_preferences(prefs).await
    }

    // Reset to defaults
    pub async fn reset_to_defaults(&self) -> Result<()> {
        // Theme
        self.set_theme("system").await?;
        
        // Font
        self.set_font_settings(&FontSettings::default()).await?;
        
        // Editor
        self.set_editor_settings(&EditorSettings::default()).await?;
        
        // AI
        self.set_ai_settings(&AISettings::default()).await?;
        
        // UI
        self.set_ui_preferences(&UIPreferences::default()).await?;
        
        Ok(())
    }
}

impl Default for FontSettings {
    fn default() -> Self {
        Self {
            family: "Inter".to_string(),
            size: 14,
            line_height: 1.6,
        }
    }
}

impl Default for EditorSettings {
    fn default() -> Self {
        Self {
            mode: "wysiwyg".to_string(),
            auto_save: true,
            auto_save_interval: 2000,
            spell_check: true,
            show_line_numbers: false,
            vim_mode: false,
        }
    }
}

impl Default for AISettings {
    fn default() -> Self {
        Self {
            transcription_language: "auto".to_string(),
            transcription_model: "funasr".to_string(),
            analysis_model: "local".to_string(),
            api_provider: "openai".to_string(),
        }
    }
}

impl Default for UIPreferences {
    fn default() -> Self {
        Self {
            sidebar_collapsed: false,
            editor_layout: "single".to_string(),
            show_word_count: true,
            show_reading_time: true,
        }
    }
}